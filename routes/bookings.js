import { Router } from "express";
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

export default router;
