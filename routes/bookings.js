import { Router } from "express";
import { ObjectId } from "mongodb";
import { col } from "../config/db.js";
import { verifyToken, verifyRenter, verifyOwner, verifyAdmin } from "../middleware/auth.js";
import { paginate, completeExpiredBookings } from "../utils/bookings.js";

const router = Router();

// All booking queries require authentication
router.use(verifyToken);

/**
 * GET /bookings/my
 * Customer Dashboard: Displays all rental bookings made by the currently logged-in customer.
 * Auto-triggers lazy completion of expired rentals and supports pagination.
 */
router.get("/my", verifyRenter, async (req, res) => {
  try {
    await completeExpiredBookings();
    const bookingsCol = await col("bookings");
    const result = await paginate(bookingsCol, { customerEmail: req.user.email }, req);
    res.json(result);
  } catch (err) {
    console.error("Error fetching customer bookings:", err);
    res.status(500).json({ message: "Failed to retrieve your rental bookings" });
  }
});

/**
 * GET /bookings/owner
 * Owner Dashboard: Displays all equipment rental records for the equipment owned by
 * the currently logged-in equipment owner.
 */
router.get("/owner", verifyOwner, async (req, res) => {
  try {
    await completeExpiredBookings();
    const bookingsCol = await col("bookings");
    const result = await paginate(bookingsCol, { ownerEmail: req.user.email }, req);
    res.json(result);
  } catch (err) {
    console.error("Error fetching owner equipment bookings:", err);
    res.status(500).json({ message: "Failed to retrieve equipment rental requests" });
  }
});

/**
 * GET /bookings/admin
 * Admin Dashboard: Displays all rental transactions across the entire platform.
 */
router.get("/admin", verifyAdmin, async (req, res) => {
  try {
    await completeExpiredBookings();
    const bookingsCol = await col("bookings");
    const result = await paginate(bookingsCol, {}, req);
    res.json(result);
  } catch (err) {
    console.error("Error fetching admin bookings ledger:", err);
    res.status(500).json({ message: "Failed to retrieve all platform bookings" });
  }
});

/**
 * GET /bookings/:id
 * Retrieve single booking by ID for detailed invoice and receipt inspection
 */
router.get("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking ID format" });
    }

    const bookingsCol = await col("bookings");
    const booking = await bookingsCol.findOne({ _id: new ObjectId(req.params.id) });

    if (!booking) {
      return res.status(404).json({ message: "Booking record not found" });
    }

    const isCustomer = booking.customerEmail === req.user.email;
    const isOwner = booking.ownerEmail === req.user.email;
    const isAdmin = req.user.role === "admin";

    if (!isCustomer && !isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden: Not authorized to view this booking record" });
    }

    res.json(booking);
  } catch (err) {
    console.error("Error fetching single booking:", err);
    res.status(500).json({ message: "Failed to load booking details" });
  }
});

/**
 * PATCH /bookings/:id/cancel
 * Customer or Admin can cancel a confirmed booking prior to its completion
 */
router.patch("/:id/cancel", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking ID format" });
    }

    const bookingsCol = await col("bookings");
    const booking = await bookingsCol.findOne({ _id: new ObjectId(req.params.id) });

    if (!booking) {
      return res.status(404).json({ message: "Booking record not found" });
    }

    const isCustomer = booking.customerEmail === req.user.email;
    const isAdmin = req.user.role === "admin";

    if (!isCustomer && !isAdmin) {
      return res.status(403).json({ message: "Forbidden: Not authorized to cancel this booking" });
    }

    if (booking.bookingStatus !== "confirmed") {
      return res.status(400).json({
        message: `Cannot cancel a booking with status '${booking.bookingStatus}'`,
      });
    }

    const { reason = "Customer requested cancellation" } = req.body || {};

    await bookingsCol.updateOne(
      { _id: booking._id },
      {
        $set: {
          bookingStatus: "cancelled",
          cancellationReason: reason,
          cancelledAt: new Date(),
        },
      }
    );

    res.json({ success: true, message: "Rental booking cancelled successfully" });
  } catch (err) {
    console.error("Error cancelling booking:", err);
    res.status(500).json({ message: "Failed to cancel booking" });
  }
});

/**
 * PATCH /bookings/:id/complete
 * Owner or Admin can mark an ongoing booking as completed early
 */
router.patch("/:id/complete", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid booking ID format" });
    }

    const bookingsCol = await col("bookings");
    const booking = await bookingsCol.findOne({ _id: new ObjectId(req.params.id) });

    if (!booking) {
      return res.status(404).json({ message: "Booking record not found" });
    }

    const isOwner = booking.ownerEmail === req.user.email;
    const isAdmin = req.user.role === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: "Forbidden: Only the equipment owner or admin can mark orders completed" });
    }

    await bookingsCol.updateOne(
      { _id: booking._id },
      {
        $set: {
          bookingStatus: "completed",
          completedAt: new Date(),
        },
      }
    );

    res.json({ success: true, message: "Rental marked as completed" });
  } catch (err) {
    console.error("Error completing booking:", err);
    res.status(500).json({ message: "Failed to mark booking completed" });
  }
});

export default router;
