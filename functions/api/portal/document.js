// Cloudflare Pages Function: /api/portal/document
// Driver uploads a document (e.g. signed hire agreement) from My Account. The CRM stores it
// in the driver's documents, where staff see it and it appears in the portal's Documents.
import { forwardToCrm } from '../../_lib/portal-crm-forward.js';

export async function onRequestPost(context) {
  return forwardToCrm(context, '/api/public/portal/document', { maxBodyBytes: 15 * 1024 * 1024 });
}
