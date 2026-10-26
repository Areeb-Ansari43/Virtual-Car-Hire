// Cloudflare Pages Function: /api/portal/request-code
// Proxies 2FA request-code call to CRM_API_URL

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

    const { email, password } = bodyData;
    if (!email || !password) {
      return new Response(
        JSON.stringify({ success: false, error: "Unable to sign in. Check your details and try again." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const targetUrl = `${crmApiUrl.replace(/\/+$/, "")}/api/public/portal-auth/request-code`;

    let upstreamRes;
    try {
      upstreamRes = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Portal-Secret": portalSecret
        },
        body: JSON.stringify({ email, password })
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
      const isUnsupported = upstreamData && (upstreamData.delivery === "unsupported" || upstreamData.error === "unsupported");
      return new Response(
        JSON.stringify({
          success: false,
          delivery: isUnsupported ? "unsupported" : undefined,
          error: isUnsupported ? "unsupported" : "Unable to sign in. Check your details and try again."
        }),
        { status: upstreamRes.status || 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const responsePayload = {
      success: upstreamData.success !== false,
      delivery: upstreamData.delivery,
      masked_email: upstreamData.masked_email,
      message: upstreamData.message
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
