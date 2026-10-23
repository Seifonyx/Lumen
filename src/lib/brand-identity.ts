/**
 * Switch for the Crease identity PREVIEW (owner review only; not the official brand). Off everywhere by default:
 * this module exports no components, so no build imports the drawings and every guarded branch folds away; the
 * ordinary and Canvas builds keep the shipped folded-L. A build turns it on by resolving this module to
 * brand-identity.on.ts, only with LUMEN_IDENTITY=crease together with LUMEN_CANVAS=1 (vite.config.ts). No workflow
 * sets it; adopting the identity needs the owner's approval first.
 *   BrandWordmark — the integrated wordmark (the Crease as the L of "Lumen"), src/components/BrandCrease.tsx.
 *   BrandMark     — the standalone mark, for compact placements.
 */
import type { ComponentType } from 'react';
export type BrandArtProps = { height: number; decorative?: boolean; className?: string };
export const CREASE_IDENTITY = false;
export const BrandWordmark: ComponentType<BrandArtProps> | null = null;
export const BrandMark: ComponentType<BrandArtProps> | null = null;
