// A same-origin proxy keeps Secure, HttpOnly session cookies first-party on Pages.
// Configure Pages service binding API -> beehive-api.
export const onRequest: PagesFunction<{ API: Fetcher }> = async (context) => {
  return context.env.API.fetch(context.request);
};
