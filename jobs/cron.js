import cron from "node-cron";
import { completeExpiredBookings } from "../utils/bookings.js";

/**
 * startCron
 * Schedules an automated background job running every hour (and at 00:05 daily)
 * to automatically scan and update confirmed bookings whose rental end dates
 * have elapsed to 'completed' status.
 */
export function startCron() {
  // Runs every hour at minute 5: "5 * * * *"
  cron.schedule("5 * * * *", async () => {
    try {
      const count = await completeExpiredBookings();
      if (count > 0) {
        console.log(`[Cron Task] Auto-completed ${count} elapsed booking(s)`);
      }
    } catch (err) {
      console.error("[Cron Task Error]:", err.message);
    }
  });

  console.log("[Rentara Cron Engine] Scheduled automated rental lifecycle manager");
}
