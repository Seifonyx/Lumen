// Canvas route line after a fallback: the stream's notice "Pro hit its usage limit — switched to Flash." (src/lib/ai/chat.js)
// becomes "Rerouted: Pro hit its usage limit" beside the model that answered, instead of a separate notice box.
const SWITCHED = / — switched to [^—]+\.$/;

export const isReroute = (notice: string) => SWITCHED.test(notice);

export function rerouteReason(notices: string[] | undefined): string | undefined {
  const n = notices?.find(isReroute);
  return n ? n.replace(SWITCHED, '') : undefined;
}
