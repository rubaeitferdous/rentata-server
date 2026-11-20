import { Router } from "express";
import { col } from "../config/db.js";
import { verifyToken, verifyOwner, verifyAdmin } from "../middleware/auth.js";
import { completeExpiredBookings } from "../utils/bookings.js";

const router = Router();

/**
 * Challenge 3: Admin Dashboard Analytics
 * Computes high-level platform health metrics and financial summaries:
 * - Total users count
 * - Total equipment catalog size
 * - Total bookings volume
 * - Pending equipment approvals count
 * - Completed rentals count
 * - Total platform revenue (payments aggregation)
 * - Monthly booking & revenue statistics breakdown for charts
 */
router.get("/admin", verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Lazily update expired bookings so metrics are strictly accurate
    await completeExpiredBookings();

    const [usersCol, equipmentCol, bookingsCol, paymentsCol] = await Promise.all([
      col("user"),
      col("equipment"),
      col("bookings"),
      col("payments"),
    ]);

    const [
      totalUsers,
      totalEquipment,
      totalBookings,
      pendingApprovals,
      completedRentals,
      revenueAgg,
      monthly,
    ] = await Promise.all([
      usersCol.countDocuments(),
      equipmentCol.countDocuments(),
      bookingsCol.countDocuments(),
      equipmentCol.countDocuments({ status: "pending" }),
      bookingsCol.countDocuments({ bookingStatus: "completed" }),
      paymentsCol
        .aggregate([
          { $match: { paymentStatus: "paid" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray(),
      bookingsCol
        .aggregate([
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
              bookings: { $sum: 1 },
              revenue: { $sum: "$totalAmount" },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              month: "$_id",
              bookings: 1,
              revenue: { $round: ["$revenue", 2] },
            },
          },
        ])
        .toArray(),
    ]);

    res.json({
      totalUsers,
      totalEquipment,
      totalBookings,
      pendingApprovals,
      completedRentals,
      totalRevenue: revenueAgg[0]?.total ? Math.round(revenueAgg[0].total * 100) / 100 : 0,
      monthly,
    });
  } catch (err) {
    console.error("Error computing admin analytics:", err);
    res.status(500).json({ message: "Failed to generate administrator analytics" });
  }
});

/**
 * Challenge 3: Equipment Owner Analytics
 * Computes owner-specific performance metrics:
 * - Total equipment listed by owner
 * - Total bookings received for owner's equipment
 * - Completed rentals count
 * - Total gross earnings from completed/confirmed bookings
 * - Monthly earnings and rental volume breakdown for charts
 */
router.get("/owner", verifyToken, verifyOwner, async (req, res) => {
  try {
    await completeExpiredBookings();

    const [equipmentCol, bookingsCol, paymentsCol] = await Promise.all([
      col("equipment"),
      col("bookings"),
      col("payments"),
    ]);

    const ownerEmail = req.user.email;

    const [
      totalEquipment,
      totalBookings,
      completedRentals,
      earningsAgg,
      monthly,
    ] = await Promise.all([
      equipmentCol.countDocuments({ ownerEmail }),
      bookingsCol.countDocuments({ ownerEmail }),
      bookingsCol.countDocuments({ ownerEmail, bookingStatus: "completed" }),
      paymentsCol
        .aggregate([
          { $match: { ownerEmail, paymentStatus: "paid" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ])
        .toArray(),
      paymentsCol
        .aggregate([
          { $match: { ownerEmail, paymentStatus: "paid" } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
              earnings: { $sum: "$amount" },
              bookings: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              month: "$_id",
              earnings: { $round: ["$earnings", 2] },
              bookings: 1,
            },
          },
        ])
        .toArray(),
    ]);

    res.json({
      totalEquipment,
      totalBookings,
      completedRentals,
      totalEarnings: earningsAgg[0]?.total ? Math.round(earningsAgg[0].total * 100) / 100 : 0,
      monthly,
    });
  } catch (err) {
    console.error("Error computing owner analytics:", err);
    res.status(500).json({ message: "Failed to generate owner business analytics" });
  }
});

export default router;
