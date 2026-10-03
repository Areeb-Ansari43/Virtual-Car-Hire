# Virtual Car Hire

Virtual Car Hire public website and driver portal.

## Environment Variables

The following environment variables are required for Cloudflare Pages Functions:

- `RESEND_API_KEY`: Resend API key used by `/api/submit-contact` to dispatch email notifications.
- `FROM_EMAIL`: Sender email address for contact form emails (defaults to `forms@fa-ibi.co.uk`).
- `ADMIN_EMAIL`: Destination email address for admin form notifications (defaults to `info@fa-ibi.co.uk`).
- `CRM_API_URL`: Base URL of the internal CRM service backend (e.g. `https://crm.fa-ibi.co.uk`). Used by `/api/portal/request-code` and `/api/portal/verify-code` to proxy 2FA authentication requests server-to-server.
- `PORTAL_SHARED_SECRET`: Secret token passed in the `X-Portal-Secret` HTTP header to authenticate server-to-server 2FA requests between Cloudflare Pages Functions and the CRM backend.
