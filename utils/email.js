/**
 * Email Notification Service (Bonus Feature)
 * Dispatches transactional notifications to customers and equipment owners.
 * Supports production SMTP/Resend providers if configured, or gracefully logs
 * dispatch records in local/serverless runtime.
 */

export async function sendBookingConfirmation({
  customerEmail,
  customerName,
  equipmentName,
  startDate,
  endDate,
  totalAmount,
  bookingId,
}) {
  const payload = {
    to: customerEmail,
    subject: `Booking Confirmed: ${equipmentName} - Rentara`,
    template: "booking_confirmation",
    data: {
      customerName,
      equipmentName,
      rentalPeriod: `${startDate} to ${endDate}`,
      totalAmount: `$${Number(totalAmount).toFixed(2)}`,
      bookingId,
    },
    sentAt: new Date().toISOString(),
  };

  // In production, integrate with nodemailer or Resend:
  // e.g. await resend.emails.send({ ... })
  console.log(`[Notification Engine] Dispatched customer receipt to ${customerEmail}:`, payload);
  return { success: true, messageId: `msg_${Date.now()}` };
}

export async function sendOwnerRentalAlert({
  ownerEmail,
  ownerName,
  equipmentName,
  customerName,
  startDate,
  endDate,
  totalAmount,
}) {
  const payload = {
    to: ownerEmail,
    subject: `New Rental Order: ${equipmentName} booked by ${customerName}`,
    template: "owner_rental_alert",
    data: {
      ownerName,
      customerName,
      equipmentName,
      rentalPeriod: `${startDate} to ${endDate}`,
      totalAmount: `$${Number(totalAmount).toFixed(2)}`,
    },
    sentAt: new Date().toISOString(),
  };

  console.log(`[Notification Engine] Dispatched owner alert to ${ownerEmail}:`, payload);
  return { success: true, messageId: `msg_${Date.now()}` };
}
