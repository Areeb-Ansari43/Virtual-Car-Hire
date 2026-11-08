# Virtual-Car-Hire

Public website and customer driver portal for Virtual Car Hire (FA-IBI LTD).

## Environment Variables

The following environment variables should be configured in your hosting platform (e.g. Cloudflare Pages):

### Driver Portal Two-Factor Authentication (2FA)

- `CRM_API_URL`: The base URL of the internal CRM authentication backend (e.g. `https://crm.example.com`). Server-side proxy functions forward authentication requests to `${CRM_API_URL}/api/public/portal-auth/request-code` and `${CRM_API_URL}/api/public/portal-auth/verify-code`.
- `PORTAL_SHARED_SECRET`: The shared secret token passed in the `X-Portal-Secret` HTTP header to authenticate server-to-server requests between this site's proxy functions and the CRM backend.
  It must be identical to `PORTAL_SHARED_SECRET` on the CRM (Cloudflare Pages project for hq.virtual-carhire.co.uk).
- `CRM_API_URL` should be `https://hq.virtual-carhire.co.uk` (no trailing slash needed).

#### Diagnosing driver portal sign-in

`GET /api/portal/diagnostics` with header `X-Portal-Secret: <PORTAL_SHARED_SECRET>` reports whether
`CRM_API_URL`, `PORTAL_SHARED_SECRET`, `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set (names only),
whether the CRM is reachable, and whether the shared-secret handshake with the CRM succeeds
(`handshake.code`: `ok`, `secret_mismatch`, `crm_missing_config`, `crm_unreachable`, `crm_blocked`, `crm_5xx`).
Failed sign-ins are logged to the Cloudflare function log as JSON with a `result_code`, and recorded in the
CRM's `portal_auth_events` table (source `Portal`) whenever the CRM is reachable.

### Contact Forms & Resend API

- `RESEND_API_KEY`: API key for Resend email dispatching.
- `FROM_EMAIL`: Sender email address (defaults to `forms@fa-ibi.co.uk`).
- `ADMIN_EMAIL`: Admin notification recipient email address (defaults to `info@fa-ibi.co.uk`).
