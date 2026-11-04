// Browser tabs own the system Back/Forward edges. A Home Screen app still needs a touch Back.
import { isIOS, isStandalone } from './device';

const EDGE = 24;
const BROWSER_EDGE = 32;
export const browserOwnsEdges = () => isIOS() && !isStandalone();
export const isBackEdge = (x: number) => x <= EDGE;
/** Who owns the current horizontal touch: Back (a pushed screen) or the drawer (a root screen). The Canvas navigation
 * coordinator decides at touchstart; the drawer gesture yields while Back owns it. */
export const gestureOwner: { current: null | 'back' } = { current: null };
export const isBrowserEdge = (x: number) => browserOwnsEdges() && (x <= BROWSER_EDGE || x >= window.innerWidth - BROWSER_EDGE);
