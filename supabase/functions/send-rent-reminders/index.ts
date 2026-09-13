// Supabase Edge Function: Send Scheduled Rent, Deposit & Service Reminder Emails
// Triggered via Supabase Scheduled Cron / pg_cron

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || Deno.env.get("SMTP_API_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendEmail(to: string, subject: string, htmlContent: string) {
  if (!RESEND_API_KEY) {
    console.log(`[DRY RUN] Would send email to ${to}: ${subject}`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: "Virtual Car Hire <info@virtualcarhire.co.uk>",
      to: [to],
      subject,
      html: htmlContent,
    }),
  });
}

serve(async (req) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // 1. Rent Due Reminders (Upcoming in 2 days or Overdue)
    const { data: dueRentals } = await supabase
      .from("rentals")
      .select("*, drivers!inner(email, full_name)")
      .not("drivers.email", "is", null);

    if (dueRentals) {
      for (const rental of dueRentals) {
        if (!rental.drivers?.email) continue;

        if (rental.rent_status === "overdue") {
          await sendEmail(
            rental.drivers.email,
            "Urgent: PCO Rent Overdue - Virtual Car Hire",
            `<p>Hi ${rental.drivers.full_name || 'Driver'},</p><p>Your weekly rental payment of <strong>£${rental.weekly_rent}</strong> for vehicle <strong>${rental.vehicle_reg}</strong> is currently <strong>overdue</strong>. Please log in to your driver portal to check details or contact staff.</p><p><a href="https://virtualcarhire.pages.dev/portal/login">Access Driver Portal</a></p>`
          );
        }
      }
    }

    // 2. Upcoming Service Reminders
    const { data: upcomingServices } = await supabase
      .from("service_bookings")
      .select("*, drivers!inner(email, full_name)")
      .eq("status", "confirmed")
      .gte("booking_date", today);

    if (upcomingServices) {
      for (const service of upcomingServices) {
        if (!service.drivers?.email) continue;

        await sendEmail(
          service.drivers.email,
          "Reminder: Upcoming PCO Vehicle Service Booking",
          `<p>Hi ${service.drivers.full_name || 'Driver'},</p><p>This is a reminder for your scheduled vehicle maintenance booking on <strong>${service.booking_date}</strong>.</p><p><a href="https://virtualcarhire.pages.dev/portal/login">View Details in Portal</a></p>`
        );
      }
    }

    return new Response(JSON.stringify({ success: true, timestamp: new Date() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
