// Unit test for submit-contact Cloudflare Pages Function & Resend email generation

const assert = require("assert");
const fs = require("fs");
const path = require("path");

async function runTests() {
  console.log("--- Testing Contact Form & Email Generation Function ---");

  // Import onRequestPost
  const functionPath = path.join(__dirname, "../functions/api/submit-contact.js");
  const code = fs.readFileSync(functionPath, "utf8");

  function getPostHandler(fetchMock) {
    const functionExports = {};
    const cjsCode = code.replace("export async function onRequestPost", "exports.onRequestPost = async function");
    const evalFunc = new Function("exports", "console", "fetch", cjsCode);
    evalFunc(functionExports, console, fetchMock);
    return functionExports.onRequestPost;
  }

  let capturedFetches = [];
  const defaultFetchMock = async (url, opts) => {
    capturedFetches.push({ url, opts, body: JSON.parse(opts.body) });
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_12345" }),
      text: async () => "ok"
    };
  };

  function createMockRequest(bodyObj, method = "POST") {
    const headers = new Map([["content-type", "application/json"]]);
    return {
      method: method,
      headers: {
        get: (h) => headers.get(h.toLowerCase()) || null
      },
      json: async () => bodyObj
    };
  }

  const onRequestPost = getPostHandler(defaultFetchMock);

  // 1. Test non-POST method returns 405 Method Not Allowed
  let req = createMockRequest({}, "GET");
  let res = await onRequestPost({
    request: req,
    env: { RESEND_API_KEY: "re_test" }
  });
  let resJson = await res.json();
  assert.strictEqual(res.status, 405);
  assert.strictEqual(resJson.success, false);
  console.log("✅ PASS: 405 Method Not Allowed on non-POST requests.");

  // 2. Test missing RESEND_API_KEY returns 500 configuration error
  capturedFetches = [];
  req = createMockRequest({
    name: "John Smith",
    phone: "+44 7123 456789",
    email: "john.smith@example.com",
    subject: "General Enquiry",
    message: "Test message"
  });

  res = await onRequestPost({
    request: req,
    env: {
      FROM_EMAIL: "forms@fa-ibi.co.uk",
      ADMIN_EMAIL: "admin@fa-ibi.co.uk"
    }
  });

  resJson = await res.json();
  assert.strictEqual(res.status, 500);
  assert.strictEqual(resJson.success, false);
  assert.ok(resJson.error.includes("Server configuration error"));
  console.log("✅ PASS: Server configuration error when RESEND_API_KEY is missing.");

  // 3. Test missing/invalid customer email returns 400
  capturedFetches = [];
  req = createMockRequest({
    name: "John Smith",
    phone: "+44 7123 456789",
    subject: "General Enquiry"
  });

  res = await onRequestPost({
    request: req,
    env: {
      RESEND_API_KEY: "re_test_key_123",
      FROM_EMAIL: "forms@fa-ibi.co.uk",
      ADMIN_EMAIL: "admin@fa-ibi.co.uk"
    }
  });

  resJson = await res.json();
  assert.strictEqual(res.status, 400);
  assert.strictEqual(resJson.success, false);
  assert.ok(resJson.error.includes("valid email address"));
  console.log("✅ PASS: 400 validation error when customer email is invalid or missing.");

  // 4. Test successful submission with RESEND_API_KEY
  capturedFetches = [];
  req = createMockRequest({
    name: "John Smith",
    phone: "+44 7123 456789",
    email: "john.smith@example.com",
    subject: "General Enquiry",
    message: "I would like to get more information about vehicle rental options.<script>alert(1)</script>"
  });

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

  // 5. Test Admin Email failure handling (adminRes.ok === false)
  const failingAdminFetchMock = async (url, opts) => {
    return {
      ok: false,
      status: 400,
      text: async () => "Resend rejected admin email"
    };
  };

  const failingAdminPostHandler = getPostHandler(failingAdminFetchMock);

  res = await failingAdminPostHandler({
    request: req,
    env: {
      RESEND_API_KEY: "re_test_key_123",
      FROM_EMAIL: "forms@fa-ibi.co.uk",
      ADMIN_EMAIL: "admin@fa-ibi.co.uk"
    }
  });

  resJson = await res.json();
  assert.strictEqual(res.status, 500);
  assert.strictEqual(resJson.success, false);
  assert.ok(resJson.error.includes("Failed to send notification email"));
  console.log("✅ PASS: Explicit error handling when Resend rejects admin email.");

  // 6. Test Customer Email failure handling (customerRes.ok === false)
  const failingCustomerFetchMock = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.subject.includes("We have received your enquiry")) {
      return {
        ok: false,
        status: 400,
        text: async () => "Resend rejected customer recipient"
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: "msg_12345" }),
      text: async () => "ok"
    };
  };

  const failingCustomerPostHandler = getPostHandler(failingCustomerFetchMock);

  res = await failingCustomerPostHandler({
    request: req,
    env: {
      RESEND_API_KEY: "re_test_key_123",
      FROM_EMAIL: "forms@fa-ibi.co.uk",
      ADMIN_EMAIL: "admin@fa-ibi.co.uk"
    }
  });

  resJson = await res.json();
  assert.strictEqual(res.status, 500);
  assert.strictEqual(resJson.success, false);
  assert.ok(resJson.error.includes("Failed to send customer confirmation email"));
  console.log("✅ PASS: Explicit error handling when Resend rejects customer confirmation email.");

  // 7. Verify thank-you.html page requirements
  const thankYouHtml = fs.readFileSync(path.join(__dirname, "../thank-you.html"), "utf8");
  assert.ok(thankYouHtml.includes('name="robots" content="noindex,follow"'), "thank-you.html includes noindex,follow");
  assert.ok(thankYouHtml.includes('rel="canonical" href="https://www.virtual-carhire.co.uk/thank-you"'), "thank-you.html uses canonical www URL");
  assert.ok(thankYouHtml.includes("within 24 hours"), "thank-you.html says 24 hours");
  assert.ok(!thankYouHtml.includes("virtualcarhire.pages.dev"), "thank-you.html has no pages.dev URLs");

  console.log("✅ PASS: thank-you.html page canonical, noindex, and 24-hour wording verified.");

  // 8. Verify contact-us.html page requirements
  const contactUsHtml = fs.readFileSync(path.join(__dirname, "../contact-us.html"), "utf8");
  assert.ok(!contactUsHtml.includes("formsubmit.co"), "contact-us.html has no formsubmit.co reference");
  assert.ok(!contactUsHtml.includes('name="_subject"'), "contact-us.html has no FormSubmit _subject field");
  assert.ok(!contactUsHtml.includes('name="_captcha"'), "contact-us.html has no FormSubmit _captcha field");
  assert.ok(!contactUsHtml.includes('name="_template"'), "contact-us.html has no FormSubmit _template field");
  assert.ok(!contactUsHtml.includes('name="_next"'), "contact-us.html has no FormSubmit _next field");
  assert.ok(contactUsHtml.includes('<form id="contactForm" method="POST">'), "contact-us.html form uses method POST without FormSubmit action");
  assert.ok(contactUsHtml.includes("We Reply Within 24 Hours"), "contact-us.html hero pill says We Reply Within 24 Hours");
  assert.ok(contactUsHtml.includes("fetch('/api/submit-contact'"), "contact-us.html JS posts to /api/submit-contact");
  assert.ok(contactUsHtml.includes("window.location.href = '/thank-you'"), "contact-us.html JS redirects to /thank-you on success");
  assert.ok(contactUsHtml.includes('href="https://www.virtual-carhire.co.uk/contact-us"'), "contact-us.html canonical URL preserved");

  console.log("✅ PASS: contact-us.html page form markup, 24-hour wording, JS endpoint, and canonical URL verified.");

  console.log("\n🎉 All submit-contact unit tests passed successfully!");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
