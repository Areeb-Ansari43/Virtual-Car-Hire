// Cloudflare Pages Function: /api/portal/verify-code
// Proxies 2FA verify-code call to CRM_API_URL

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method Not Allowed" }),
        { status: 405, headers: { "Content-Type": "application/json", "Allow": "POST" } }
      );
    }

    const crmApiUrl = env.CRM_API_URL;
    const portalSecret = env.PORTAL_SHARED_SECRET;

    if (!crmApiUrl || !portalSecret) {
      console.error("[Portal Auth Proxy Error] Required environment variables missing.");
      return new Response(
        JSON.stringify({ success: false, error: "Unable to sign in. Check your details and try again." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    let bodyData = {};
    try {
      bodyData = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, error: "Unable to sign in. Check your details and try again." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { email, code } = bodyData;
    if (!email || !code) {
      return new Response(
        JSON.stringify({ success: false, error: "Unable to sign in. Check your details and try again." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const targetUrl = `${crmApiUrl.replace(/\/+$/, "")}/api/public/portal-auth/verify-code`;

    let upstreamRes;
    try {
      upstreamRes = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Portal-Secret": portalSecret
        },
        body: JSON.stringify({ email, code })
      });
    } catch (fetchErr) {
      console.error("[Portal Auth Proxy Fetch Error]");
      return new Response(
        JSON.stringify({ success: false, error: "Unable to sign in. Check your details and try again." }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    if (upstreamRes.status === 429) {
      return new Response(
        JSON.stringify({ success: false, error: "Please wait before requesting another code." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    let upstreamData = {};
    try {
      upstreamData = await upstreamRes.json();
    } catch (e) {
      upstreamData = {};
    }

    if (!upstreamRes.ok) {
      let userMsg = "Unable to sign in. Check your details and try again.";
      const codeErr = (upstreamData && (upstreamData.error_code || upstreamData.code || upstreamData.error)) || "";

      if (codeErr === "EXPIRED_CODE" || /expired/i.test(String(codeErr))) {
        userMsg = "Verification code has expired. Please request a new code.";
      } else if (codeErr === "LOCKED_OUT" || /locked|too many attempts/i.test(String(codeErr))) {
        userMsg = "Account temporarily locked due to too many failed attempts. Please try again later or contact support.";
      } else if (codeErr === "INVALID_CODE" || /invalid|incorrect/i.test(String(codeErr))) {
        userMsg = "Incorrect verification code. Please check the code and try again.";
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: userMsg
        }),
        { status: upstreamRes.status || 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Pass through documented fields
    const responsePayload = {
      success: upstreamData.success !== false,
      access_token: upstreamData.access_token || (upstreamData.session && upstreamData.session.access_token),
      refresh_token: upstreamData.refresh_token || (upstreamData.session && upstreamData.session.refresh_token),
      expires_in: upstreamData.expires_in,
      user: upstreamData.user
    };

    return new Response(
      JSON.stringify(responsePayload),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[Portal Auth Proxy Exception]");
    return new Response(
      JSON.stringify({ success: false, error: "Unable to sign in. Check your details and try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
