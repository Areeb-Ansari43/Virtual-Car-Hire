// Cloudflare Pages Function: /api/submit-contact
// Handles contact form submissions and dispatches emails via Resend API

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

function generateAdminEmailHtml(formData) {
  const logoUrl = "https://www.virtual-carhire.co.uk/assets/logo.png";
  const siteUrl = "https://www.virtual-carhire.co.uk/";

  // Known field order & human readable labels
  const labelMap = {
    name: "NAME",
    full_name: "FULL NAME",
    firstName: "FIRST NAME",
    lastName: "LAST NAME",
    phone: "MOBILE NUMBER",
    mobile: "MOBILE NUMBER",
    telephone: "TELEPHONE",
    email: "EMAIL ADDRESS",
    subject: "SUBJECT",
    message: "DESCRIPTION / MESSAGE",
    details: "DESCRIPTION / MESSAGE",
    vehicle: "VEHICLE",
    car: "VEHICLE",
    hire_type: "HIRE TYPE",
    hireType: "HIRE TYPE",
    location: "LOCATION",
    start_date: "START DATE",
    startDate: "START DATE",
    end_date: "END DATE",
    endDate: "END DATE"
  };

  // Build rows dynamically from all entries in formData
  let rowsHtml = "";
  for (const [key, rawValue] of Object.entries(formData)) {
    if (!rawValue) continue;
    // Skip internal form submit keys if any
    if (key.startsWith("_")) continue;

    const label = labelMap[key] || key.replace(/_/g, " ").toUpperCase();
    const formattedValue = escapeHtml(rawValue).replace(/\n/g, "<br/>");

    rowsHtml += `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #eef0f3;">
          <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #f7791f; text-transform: uppercase; margin-bottom: 4px;">
            ${escapeHtml(label)}
          </div>
          <div style="font-size: 15px; font-weight: 600; color: #111827; line-height: 1.5;">
            ${formattedValue}
          </div>
        </td>
      </tr>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>New Website Form Submission</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 20px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">

          <!-- HERO HEADER SECTION -->
          <tr>
            <td style="background-color: #0b132b; padding: 36px 32px 32px; text-align: center;">
              <a href="${siteUrl}" target="_blank" style="text-decoration: none; display: inline-block; margin-bottom: 20px;">
                <img src="${logoUrl}" alt="Virtual Car Hire" width="160" style="display: block; width: 160px; max-width: 100%; height: auto; border: 0;" />
              </a>
              <h1 style="color: #ffffff; font-size: 24px; font-weight: 800; margin: 0 0 10px; line-height: 1.3; letter-spacing: -0.5px;">
                New website form submission received.
              </h1>
              <p style="color: #94a3b8; font-size: 14px; margin: 0; line-height: 1.5;">
                You have received a new form submission on your website. Here are the details from the form:
              </p>
            </td>
          </tr>

          <!-- CONTENT / CUSTOMER INFO CARD -->
          <tr>
            <td style="padding: 32px 28px; background-color: #ffffff;">
              <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 16px;">
                Dear Admin,
              </p>
              <p style="font-size: 14px; color: #475569; margin: 0 0 24px; line-height: 1.5;">
                You have received a new form submission on your website. Here are the details from the form:
              </p>

              <!-- SUBMITTED INFORMATION CARD -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; border: 2px solid #f7791f; border-radius: 12px; overflow: hidden; border-collapse: separate;">
                ${rowsHtml}
              </table>

              <!-- ACTION / ALERT BOX -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-top: 28px;">
                <tr>
                  <td style="background-color: #0b132b; border-radius: 10px; padding: 18px 20px; color: #ffffff;">
                    <p style="margin: 0 0 6px; font-size: 14px; font-weight: 700; color: #ff9a3d;">
                      ⚠️ Action Required
                    </p>
                    <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #f8fafc; line-height: 1.4;">
                      Please review the details above and take action before the enquiry expires.
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
                      This form submission has been sent from your website's contact form.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #0f172a; padding: 24px 28px; text-align: center; border-top: 1px solid #1e293b;">
              <a href="${siteUrl}" target="_blank" style="text-decoration: none; display: inline-block; margin-bottom: 12px;">
                <img src="${logoUrl}" alt="Virtual Car Hire" width="120" style="display: block; width: 120px; max-width: 100%; height: auto; margin: 0 auto; border: 0;" />
              </a>
              <p style="color: #94a3b8; font-size: 12px; margin: 0 0 6px; line-height: 1.5;">
                <strong>Virtual Car Hire</strong> (FA-IBI LTD) | The Vista Centre, 50 Salisbury Rd, Cranford, Hounslow TW4 6JQ
              </p>
              <p style="color: #64748b; font-size: 12px; margin: 0 0 12px;">
                Phone: +44 20 7294 6756 &nbsp;|&nbsp; Email: info@fa-ibi.co.uk
              </p>
              <p style="margin: 0;">
                <a href="${siteUrl}" target="_blank" style="color: #f7791f; font-size: 12px; font-weight: 600; text-decoration: none;">
                  Visit Website &rarr;
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateCustomerConfirmationHtml(customerName) {
  const logoUrl = "https://www.virtual-carhire.co.uk/assets/logo.png";
  const siteUrl = "https://www.virtual-carhire.co.uk/";
  const safeName = escapeHtml(customerName || "Customer");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Thank You for Contacting Virtual Car Hire</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 20px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">

          <!-- HEADER -->
          <tr>
            <td style="background-color: #0b132b; padding: 32px 28px; text-align: center;">
              <a href="${siteUrl}" target="_blank" style="text-decoration: none; display: inline-block;">
                <img src="${logoUrl}" alt="Virtual Car Hire" width="160" style="display: block; width: 160px; max-width: 100%; height: auto; border: 0;" />
              </a>
            </td>
          </tr>

          <!-- BODY CONTENT -->
          <tr>
            <td style="padding: 36px 32px; background-color: #ffffff; font-size: 15px; line-height: 1.6; color: #334155;">
              <p style="margin: 0 0 16px; font-weight: 600; color: #0f172a; font-size: 16px;">
                Dear ${safeName},
              </p>
              <p style="margin: 0 0 16px;">
                Thank you for contacting Virtual Car Hire.
              </p>
              <p style="margin: 0 0 16px;">
                We have received your request and a member of our team will get back to you within 24 hours.
              </p>
              <p style="margin: 0 0 16px;">
                If you have not received a response within this time, please contact us on <strong>+44 20 7294 6756</strong>.
              </p>
              <p style="margin: 0 0 24px; padding: 12px 16px; background-color: #fff7ed; border-left: 4px solid #f7791f; border-radius: 6px; color: #9a3412; font-size: 14px;">
                Please note that our office is closed on Saturdays and Sundays, and we do not respond to enquiries during weekends.
              </p>
              <p style="margin: 0 0 4px; font-weight: 600; color: #0f172a;">
                Kind regards,
              </p>
              <p style="margin: 0; font-weight: 700; color: #f7791f;">
                Virtual Car Hire
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #0f172a; padding: 20px 28px; text-align: center; border-top: 1px solid #1e293b;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0 0 6px;">
                <strong>Virtual Car Hire</strong> | London PCO Specialists
              </p>
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                The Vista Centre, 50 Salisbury Rd, Cranford, Hounslow TW4 6JQ | +44 20 7294 6756
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // Environment variables with fallbacks
    const resendApiKey = env.RESEND_API_KEY;
    const fromEmail = env.FROM_EMAIL || "forms@fa-ibi.co.uk";
    const adminEmail = env.ADMIN_EMAIL || "info@fa-ibi.co.uk";

    if (!resendApiKey) {
      console.error("Resend API key missing server-side (RESEND_API_KEY).");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error. Please try again later or call us directly." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Format From header
    const senderFromHeader = `Virtual Car Hire <${fromEmail.trim()}>`;

    // Parse incoming payload (JSON or Form URL Encoded / FormData)
    let formData = {};
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      formData = await request.json();
    } else if (contentType.includes("form-data") || contentType.includes("x-www-form-urlencoded")) {
      const parsedFormData = await request.formData();
      for (const [key, value] of parsedFormData.entries()) {
        formData[key] = value;
      }
    } else {
      try {
        formData = await request.json();
      } catch (e) {
        // Fallback empty object
      }
    }

    // Extract core fields
    const customerName = formData.name || formData.full_name || [formData.firstName, formData.lastName].filter(Boolean).join(" ") || "Customer";
    const rawCustomerEmail = (formData.email || "").trim();
    const customerEmailValid = isValidEmail(rawCustomerEmail);

    // REQUIRE VALID CUSTOMER EMAIL
    if (!customerEmailValid) {
      return new Response(
        JSON.stringify({ success: false, error: "Please enter a valid email address." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Build Admin Email HTML and Subject
    const adminHtml = generateAdminEmailHtml(formData);
    const adminSubject = `New Virtual Car Hire Enquiry — ${customerName}`;

    // Admin Payload
    const adminResendPayload = {
      from: senderFromHeader,
      to: [adminEmail],
      reply_to: rawCustomerEmail,
      subject: adminSubject,
      html: adminHtml,
    };

    // 1. Send Admin Notification Email
    const adminRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(adminResendPayload),
    });

    if (!adminRes.ok) {
      const errText = await adminRes.text();
      console.error("Resend API Admin Email Error:", errText);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send notification email. Please try again later." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Send Customer Confirmation Email & handle response explicitly
    const customerHtml = generateCustomerConfirmationHtml(customerName);
    const customerResendPayload = {
      from: senderFromHeader,
      to: [rawCustomerEmail],
      reply_to: "info@fa-ibi.co.uk",
      subject: "We have received your enquiry — Virtual Car Hire",
      html: customerHtml,
    };

    const customerRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(customerResendPayload),
    });

    if (!customerRes.ok) {
      const errText = await customerRes.text();
      console.error("Resend API Customer Confirmation Email Error:", errText);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to send customer confirmation email. Please try again later." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "Thank you! Your enquiry has been received." }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in submit-contact function:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An unexpected error occurred." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
