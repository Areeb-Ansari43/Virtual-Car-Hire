// Cloudflare Pages Function: /api/portal/me
// Returns the signed-in driver's dashboard data (rent, vehicle, mileage, charges,
// notifications, odometer submissions, documents) from the CRM.
import { forwardToCrm } from '../../_lib/portal-crm-forward.js';

export async function onRequestPost(context) {
  return forwardToCrm(context, '/api/public/portal/me', { maxBodyBytes: 10 * 1024 });
}
