import { col } from "../config/db.js";

const todayStr = () => new Date().toISOString().slice(0, 10);

/**
 * completeExpiredBookings
 * Transitions confirmed bookings whose rental end date has elapsed to 'completed'.
 */
export async function completeExpiredBookings() {
  const bookings = await col("bookings");
  const res = await bookings.updateMany(
    {
      bookingStatus: "confirmed",
      endDate: { $lt: todayStr() },
    },
    {
      $set: {
        bookingStatus: "completed",
        completedAt: new Date(),
      },
    }
  );
  return res.modifiedCount;
}

/**
 * getAvailableQty
 * Calculates remaining available quantity for a given date window by subtracting
 * all overlapping confirmed bookings from the total stock.
 */
export async function getAvailableQty(equipment, startDate, endDate) {
  const bookings = await col("bookings");
  const eqIdStr = equipment._id.toString();

  const agg = await bookings
    .aggregate([
      {
        $match: {
          equipmentId: { $in: [eqIdStr, equipment._id] },
          bookingStatus: "confirmed",
          startDate: { $lte: endDate },
          endDate: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: null,
          bookedQty: { $sum: "$quantity" },
        },
      },
    ])
    .toArray();

  const bookedQuantity = agg[0]?.bookedQty || 0;
  return Math.max(0, equipment.availableQuantity - bookedQuantity);
}

/**
 * calcAmount
 * Accurately computes rental total amount based on duration and rental pricing model (Daily, Weekly, Monthly).
 */
export function calcAmount(equipment, startDate, endDate, quantity) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const days = Math.max(1, diffDays);

  const type = (equipment.rentalType || "Daily").toLowerCase();
  const units =
    type === "weekly"
      ? Math.ceil(days / 7)
      : type === "monthly"
      ? Math.ceil(days / 30)
      : days;

  return Math.round(units * equipment.price * quantity * 100) / 100;
}

/**
 * paginate
 * Reusable server-side pagination helper with bounds protection.
 */
export async function paginate(collection, query, req, sort = { createdAt: -1 }) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    collection.find(query).sort(sort).skip(skip).limit(limit).toArray(),
    collection.countDocuments(query),
  ]);

  return {
    items,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
