// Cloudflare Pages Function: /api/portal/mileage
// Submits a new odometer reading + photo. The CRM stores the photo, runs the AI odometer
// reader and adds it to the staff review queue.
import { forwardToCrm } from '../../_lib/portal-crm-forward.js';

export async function onRequestPost(context) {
  return forwardToCrm(context, '/api/public/portal/mileage', { maxBodyBytes: 12 * 1024 * 1024 });
}
