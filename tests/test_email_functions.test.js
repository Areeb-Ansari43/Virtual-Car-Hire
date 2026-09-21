// Unit test for submit-contact Cloudflare Pages Function & Resend email generation

const assert = require("assert");
const fs = require("fs");
const path = require("path");

async function runTests() {
  console.log("--- Testing Contact Form & Email Generation Function ---");

  // Import onRequestPost
  const functionPath = path.join(__dirname, "../functions/api/submit-contact.js");
  const code = fs.readFileSync(functionPath, "utf8");

  let capturedFetches = [];
  global.fetch = async (url, opts) => {
    capturedFetches.push({ url, opts, body: JSON.parse(opts.body) });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_12345" }),
      text: async () => "ok"
    };
  };

  const functionExports = {};
  const cjsCode = code.replace("export async function onRequestPost", "exports.onRequestPost = async function")
                     .replace("export async function onRequestGet", "exports.onRequestGet = async function");

  const evalFunc = new Function("exports", "console", "fetch", cjsCode);
  evalFunc(functionExports, console, global.fetch);

  const { onRequestPost } = functionExports;

  function createMockRequest(bodyObj) {
    const headers = new Map([["content-type", "application/json"]]);
    return {
      headers: {
        get: (h) => headers.get(h.toLowerCase()) || null
      },
      json: async () => bodyObj
    };
  }

  // 1. Test standard submission with dry run (no API key)
  capturedFetches = [];
  let req = createMockRequest({
    name: "John Smith",
    phone: "+44 7123 456789",
    email: "john.smith@example.com",
    subject: "General Enquiry",
    message: "I would like to get more information about vehicle rental options.<script>alert(1)</script>"
  });

  let res = await onRequestPost({
    request: req,
    env: {
      FROM_EMAIL: "forms@fa-ibi.co.uk",
      ADMIN_EMAIL: "admin@fa-ibi.co.uk"
    }
  });

  let resJson = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(resJson.success, true);
  console.log("✅ PASS: Dry run mode when RESEND_API_KEY is missing.");

  // 2. Test submission with RESEND_API_KEY configured
  capturedFetches = [];
  res = await onRequestPost({
    request: req,
    env: {
      RESEND_API_KEY: "re_test_key_123",
      FROM_EMAIL: "forms@fa-ibi.co.uk",
      ADMIN_EMAIL: "admin@fa-ibi.co.uk"
    }
  });

  resJson = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(resJson.success, true);
  assert.strictEqual(capturedFetches.length, 2);

  // Verify Admin Email payload
  const adminEmailCall = capturedFetches[0];
  assert.strictEqual(adminEmailCall.url, "https://api.resend.com/emails");
  assert.strictEqual(adminEmailCall.body.from, "Virtual Car Hire <forms@fa-ibi.co.uk>");
  assert.deepStrictEqual(adminEmailCall.body.to, ["admin@fa-ibi.co.uk"]);
  assert.strictEqual(adminEmailCall.body.reply_to, "john.smith@example.com");
  assert.strictEqual(adminEmailCall.body.subject, "New Virtual Car Hire Enquiry — John Smith");

  // Verify HTML content & escaping
  const adminHtml = adminEmailCall.body.html;
  assert.ok(adminHtml.includes("https://www.virtual-carhire.co.uk/assets/logo.png"), "Correct logo URL included in admin email");
  assert.ok(adminHtml.includes("New website form submission received."), "Header title present");
  assert.ok(adminHtml.includes("John Smith"), "Customer name present");
  assert.ok(adminHtml.includes("+44 7123 456789"), "Phone present");
  assert.ok(adminHtml.includes("john.smith@example.com"), "Email present");
  assert.ok(adminHtml.includes("General Enquiry"), "Subject present");
  assert.ok(adminHtml.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "XSS script escaped");

  console.log("✅ PASS: Admin notification email formatted correctly with escapes & logo.");

  // Verify Customer Confirmation Email payload
  const customerEmailCall = capturedFetches[1];
  assert.strictEqual(customerEmailCall.body.from, "Virtual Car Hire <forms@fa-ibi.co.uk>");
  assert.deepStrictEqual(customerEmailCall.body.to, ["john.smith@example.com"]);
  assert.strictEqual(customerEmailCall.body.reply_to, "info@fa-ibi.co.uk");
  assert.strictEqual(customerEmailCall.body.subject, "We have received your enquiry — Virtual Car Hire");

  const customerHtml = customerEmailCall.body.html;
  assert.ok(customerHtml.includes("Dear John Smith,"), "Customer name present in confirmation");
  assert.ok(customerHtml.includes("Thank you for contacting Virtual Car Hire."), "Confirmation body present");
  assert.ok(customerHtml.includes("+44 20 7294 6756"), "Phone number present in confirmation");
  assert.ok(customerHtml.includes("closed on Saturdays and Sundays"), "Weekend notice present in confirmation");

  console.log("✅ PASS: Customer confirmation email formatted correctly.");

  // 3. Test dynamic fields handling (extra custom form fields)
  capturedFetches = [];
  req = createMockRequest({
    name: "Areeb Ansari",
    phone: "+44 7999 888777",
    email: "areeb@example.com",
    vehicle: "Tesla Model 3",
    hire_type: "PCO Rental",
    location: "Heathrow Airport",
    start_date: "2026-04-01",
    end_date: "2026-04-15"
  });

  await onRequestPost({
    request: req,
    env: {
      RESEND_API_KEY: "re_test_key_123",
      FROM_EMAIL: "forms@fa-ibi.co.uk",
      ADMIN_EMAIL: "admin@fa-ibi.co.uk"
    }
  });

  const dynamicAdminHtml = capturedFetches[0].body.html;
  assert.ok(dynamicAdminHtml.includes("VEHICLE"), "Dynamic field label vehicle");
  assert.ok(dynamicAdminHtml.includes("Tesla Model 3"), "Dynamic field value Tesla Model 3");
  assert.ok(dynamicAdminHtml.includes("HIRE TYPE"), "Dynamic field label hire_type");
  assert.ok(dynamicAdminHtml.includes("PCO Rental"), "Dynamic field value PCO Rental");
  assert.ok(dynamicAdminHtml.includes("LOCATION"), "Dynamic field label location");
  assert.ok(dynamicAdminHtml.includes("Heathrow Airport"), "Dynamic field value Heathrow Airport");

  console.log("✅ PASS: All dynamic form fields populated in admin email.");

  console.log("\n🎉 All submit-contact unit tests passed successfully!");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
