export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (url.hostname === 'virtualcarhire.pages.dev') {
    url.hostname = 'virtual-carhire.co.uk';
    return Response.redirect(url.toString(), 301);
  }

  return context.next();
}
