import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface RentalRecord {
  id: string
  driver_id: string
  vehicle_reg: string
  weekly_rent: number
  payment_due_date: string
  status: string
  drivers: {
    full_name: string
    email: string
  }
}

interface ServiceBooking {
  id: string
  driver_id: string
  booking_date: string
  service_type: string
  status: string
  drivers: {
    full_name: string
    email: string
  }
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const today = new Date().toISOString().split('T')[0]

    // 1. Check for overdue rentals
    const { data: overdueRentals, error: rentalErr } = await supabase
      .from('rentals')
      .select('id, driver_id, vehicle_reg, weekly_rent, payment_due_date, status, drivers(full_name, email)')
      .lt('payment_due_date', today)
      .eq('status', 'overdue')

    if (rentalErr) {
      console.error('Error fetching overdue rentals:', rentalErr)
    }

    const remindersSent = []

    if (overdueRentals && overdueRentals.length > 0) {
      for (const rental of overdueRentals as unknown as RentalRecord[]) {
        if (rental.drivers?.email) {
          // Send notification email via Resend API or Supabase Auth mailer if configured
          console.log(`[RENT REMINDER] Sending overdue rent alert to ${rental.drivers.email} for vehicle ${rental.vehicle_reg}`)

          remindersSent.push({
            type: 'rent_overdue',
            driver_email: rental.drivers.email,
            vehicle: rental.vehicle_reg,
            amount: rental.weekly_rent
          })

          // Insert notification record for the driver
          await supabase.from('notifications').insert({
            driver_id: rental.driver_id,
            title: 'Overdue Rent Payment',
            message: `Your rent payment of £${rental.weekly_rent} for ${rental.vehicle_reg} was due on ${rental.payment_due_date}. Please settle balance in Portal.`,
            kind: 'payment_reminder',
            read: false
          })
        }
      }
    }

    // 2. Check for upcoming service maintenance bookings (due tomorrow)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    const { data: upcomingServices, error: serviceErr } = await supabase
      .from('service_bookings')
      .select('id, driver_id, booking_date, service_type, status, drivers(full_name, email)')
      .eq('booking_date', tomorrow)
      .eq('status', 'scheduled')

    if (serviceErr) {
      console.error('Error fetching upcoming service bookings:', serviceErr)
    }

    if (upcomingServices && upcomingServices.length > 0) {
      for (const service of upcomingServices as unknown as ServiceBooking[]) {
        if (service.drivers?.email) {
          console.log(`[SERVICE REMINDER] Sending maintenance reminder to ${service.drivers.email} for ${service.booking_date}`)

          remindersSent.push({
            type: 'service_reminder',
            driver_email: service.drivers.email,
            date: service.booking_date
          })

          await supabase.from('notifications').insert({
            driver_id: service.driver_id,
            title: 'Upcoming Service Maintenance',
            message: `Reminder: You have a vehicle service scheduled for tomorrow (${service.booking_date}).`,
            kind: 'service_reminder',
            read: false
          })
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        reminders_sent: remindersSent.length,
        details: remindersSent
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
