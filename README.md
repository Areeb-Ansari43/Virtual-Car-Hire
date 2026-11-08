# Virtual-Car-Hire

Public website and customer driver portal for Virtual Car Hire (FA-IBI LTD).

## Environment Variables

The following environment variables should be configured in your hosting platform (e.g. Cloudflare Pages):

### Driver Portal Two-Factor Authentication (2FA)

- `CRM_API_URL`: The base URL of the internal CRM authentication backend (e.g. `https://crm.example.com`). Server-side proxy functions forward authentication requests to `${CRM_API_URL}/api/public/portal-auth/request-code` and `${CRM_API_URL}/api/public/portal-auth/verify-code`.
- `PORTAL_SHARED_SECRET`: The shared secret token passed in the `X-Portal-Secret` HTTP header to authenticate server-to-server requests between this site's proxy functions and the CRM backend.

### Contact Forms & Resend API

- `RESEND_API_KEY`: API key for Resend email dispatching.
- `FROM_EMAIL`: Sender email address (defaults to `forms@fa-ibi.co.uk`).
- `ADMIN_EMAIL`: Admin notification recipient email address (defaults to `info@fa-ibi.co.uk`).
