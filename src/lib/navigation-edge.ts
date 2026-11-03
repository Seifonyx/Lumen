// Browser tabs own the system Back/Forward edges. A Home Screen app still needs a touch Back.
import { isIOS, isStandalone } from './device';

const EDGE = 24;
const BROWSER_EDGE = 32;
export const browserOwnsEdges = () => isIOS() && !isStandalone();
export const isBackEdge = (x: number) => x <= EDGE;
export const isBrowserEdge = (x: number) => browserOwnsEdges() && (x <= BROWSER_EDGE || x >= window.innerWidth - BROWSER_EDGE);
