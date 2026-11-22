import { Router } from "express";
import Stripe from "stripe";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyToken, verifyRenter } from "../middleware/auth.js";
import { calcAmount, getAvailableQty } from "../utils/bookings.js";
import { sendBookingConfirmation, sendOwnerRentalAlert } from "../utils/email.js";

const router = Router();

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe secret key is not configured yet. Please supply STRIPE_SECRET_KEY in your .env file.");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

/**
 * POST /payments/checkout
 * Validates dates and stock, computes authoritative pricing on server,
 * and creates a Stripe Checkout Session with full metadata.
 */
router.post("/checkout", verifyToken, verifyRenter, async (req, res) => {
  try {
    const {
      equipmentId,
      startDate,
      endDate,
      contactNumber,
      deliveryAddress,
      notes = "",
    } = req.body;
    const quantity = Number(req.body.quantity);

    if (
      !ObjectId.isValid(equipmentId) ||
      !startDate ||
      !endDate ||
      !contactNumber ||
      !deliveryAddress
    ) {
      return res.status(400).json({ message: "All required fields must be supplied" });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (startDate < today) {
      return res.status(400).json({ message: "Rental start date cannot be in the past" });
    }
    if (endDate < startDate) {
      return res.status(400).json({ message: "Rental end date must be on or after start date" });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be a positive integer" });
    }

    const equipmentCol = await col("equipment");
    const equipment = await equipmentCol.findOne({
      _id: new ObjectId(equipmentId),
      status: "approved",
    });

    if (!equipment) {
      return res.status(404).json({ message: "Equipment not found or unavailable for rent" });
    }

    // Availability validation against overlapping bookings
    const available = await getAvailableQty(equipment, startDate, endDate);
    if (quantity > available) {
      return res.status(409).json({
        message: `Only ${Math.max(0, available)} unit(s) available for the selected dates`,
        available,
      });
    }

    // Calculate verified total amount
    const amount = calcAmount(equipment, startDate, endDate, quantity);
    const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.replace(/\/$/, "") : "http://localhost:3000";

    // If Stripe secret key is configured, initiate real Stripe Checkout session
    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith("sk_")) {
      const stripe = getStripe();
      let session;

      try {
        session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: req.user.email,
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: Math.round(amount * 100),
                product_data: {
                  name: `${equipment.name} (${quantity} unit${quantity > 1 ? "s" : ""})`,
                  description: `Rental Period: ${startDate} to ${endDate} (${equipment.rentalType})`,
                  images:
                    equipment.image && /^https:\/\//i.test(equipment.image)
                      ? [equipment.image]
                      : [],
                },
              },
            },
          ],
          metadata: {
            equipmentId,
            startDate,
            endDate,
            quantity: String(quantity),
            contactNumber,
            deliveryAddress: deliveryAddress.slice(0, 400),
            notes: (notes || "").slice(0, 400),
            customerEmail: req.user.email,
            amount: String(amount),
          },
          success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${clientUrl}/equipment/${equipmentId}`,
        });
      } catch (stripeErr) {
        if (stripeErr.message && stripeErr.message.toLowerCase().includes("image")) {
          session = await stripe.checkout.sessions.create({
            mode: "payment",
            customer_email: req.user.email,
            line_items: [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: Math.round(amount * 100),
                  product_data: {
                    name: `${equipment.name} (${quantity} unit${quantity > 1 ? "s" : ""})`,
                    description: `Rental Period: ${startDate} to ${endDate} (${equipment.rentalType})`,
                  },
                },
              },
            ],
            metadata: {
              equipmentId,
              startDate,
              endDate,
              quantity: String(quantity),
              contactNumber,
              deliveryAddress: deliveryAddress.slice(0, 400),
              notes: (notes || "").slice(0, 400),
              customerEmail: req.user.email,
              amount: String(amount),
            },
            success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${clientUrl}/equipment/${equipmentId}`,
          });
        } else {
          throw stripeErr;
        }
      }

      return res.json({ url: session.url, sessionId: session.id });
    }

    // Sandbox / Test fallback when Stripe key has not been supplied yet
    const demoSessionId = `demo_cs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pendingCol = await col("pending_checkouts");
    await pendingCol.insertOne({
      sessionId: demoSessionId,
      customerEmail: req.user.email,
      equipmentId,
      startDate,
      endDate,
      quantity,
      contactNumber,
      deliveryAddress,
      notes,
      amount,
      createdAt: new Date(),
    });

    return res.json({
      url: `${clientUrl}/payment/success?session_id=${demoSessionId}`,
      sessionId: demoSessionId,
      demo: true,
    });
  } catch (err) {
    console.error("Error creating checkout session:", err);
    res.status(500).json({ message: err.message || "Failed to initiate payment checkout" });
  }
});

/**
 * POST /payments/confirm
 * Called upon successful return from Stripe Checkout:
 * Verifies session payment status with Stripe and idempotently writes
 * the confirmed booking and transaction record.
 */
router.post("/confirm", verifyToken, verifyRenter, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ message: "Stripe sessionId is required" });
    }

    const bookings = await col("bookings");

    // Idempotency check: if this session is already processed, return existing booking
    const existingBooking = await bookings.findOne({ sessionId });
    if (existingBooking) {
      return res.json({ booking: existingBooking, alreadyProcessed: true });
    }

    let meta = null;
    let transactionId = sessionId;
    let currency = "usd";

    if (sessionId.startsWith("demo_")) {
      const pendingCol = await col("pending_checkouts");
      const pending = await pendingCol.findOne({ sessionId });
      if (!pending) {
        return res.status(404).json({ message: "Checkout session record not found or expired" });
      }
      meta = {
        equipmentId: pending.equipmentId,
        startDate: pending.startDate,
        endDate: pending.endDate,
        quantity: pending.quantity,
        contactNumber: pending.contactNumber,
        deliveryAddress: pending.deliveryAddress,
        notes: pending.notes,
        customerEmail: pending.customerEmail,
        amount: pending.amount,
      };
      transactionId = `demo_txn_${Date.now()}`;
    } else {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });

      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Stripe payment has not been completed" });
      }

      meta = session.metadata;
      transactionId = session.payment_intent?.id || session.id;
      currency = session.currency || "usd";
    }

    if (meta.customerEmail !== req.user.email) {
      return res.status(403).json({ message: "Forbidden: Session customer email mismatch" });
    }

    const equipmentCol = await col("equipment");
    const equipment = await equipmentCol.findOne({ _id: new ObjectId(meta.equipmentId) });

    if (!equipment) {
      return res.status(404).json({ message: "Associated equipment item could not be found" });
    }

    const bookingDoc = {
      equipmentId: meta.equipmentId,
      equipmentName: equipment.name,
      equipmentImage: equipment.image,
      ownerEmail: equipment.ownerEmail,
      ownerName: equipment.ownerName,
      customerEmail: req.user.email,
      customerName: req.user.name,
      contactNumber: meta.contactNumber,
      deliveryAddress: meta.deliveryAddress,
      notes: meta.notes || "",
      startDate: meta.startDate,
      endDate: meta.endDate,
      quantity: Number(meta.quantity),
      totalAmount: Number(meta.amount),
      paymentStatus: "paid",
      bookingStatus: "confirmed",
      sessionId,
      createdAt: new Date(),
    };

    try {
      const { insertedId } = await bookings.insertOne(bookingDoc);

      const paymentsCol = await col("payments");
      await paymentsCol.insertOne({
        bookingId: insertedId.toString(),
        sessionId,
        transactionId,
        customerEmail: req.user.email,
        ownerEmail: equipment.ownerEmail,
        equipmentId: meta.equipmentId,
        amount: Number(meta.amount),
        currency,
        paymentStatus: "paid",
        createdAt: new Date(),
      });

      // Dispatched transactional notification alerts (Bonus feature)
      sendBookingConfirmation({
        customerEmail: req.user.email,
        customerName: req.user.name,
        equipmentName: equipment.name,
        startDate: meta.startDate,
        endDate: meta.endDate,
        totalAmount: Number(meta.amount),
        bookingId: insertedId.toString(),
      }).catch((err) => console.error("Customer email dispatch error:", err));

      if (equipment.ownerEmail) {
        sendOwnerRentalAlert({
          ownerEmail: equipment.ownerEmail,
          ownerName: equipment.ownerName,
          equipmentName: equipment.name,
          customerName: req.user.name,
          startDate: meta.startDate,
          endDate: meta.endDate,
          totalAmount: Number(meta.amount),
        }).catch((err) => console.error("Owner email dispatch error:", err));
      }

      res.status(201).json({
        success: true,
        booking: { ...bookingDoc, _id: insertedId },
      });
    } catch (dbErr) {
      // Duplicate key error on unique sessionId index: safe return
      if (dbErr.code === 11000) {
        const raceBooking = await bookings.findOne({ sessionId });
        return res.json({ booking: raceBooking, alreadyProcessed: true });
      }
      throw dbErr;
    }
  } catch (err) {
    console.error("Error confirming payment:", err);
    res.status(500).json({ message: err.message || "Failed to process payment confirmation" });
  }
});

export default router;
