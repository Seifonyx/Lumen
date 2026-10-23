// Synthetic QA build only, and only when the review opts in (qa/iphone/review-identity.json → LUMEN_QA_IDENTITY=crease):
// replaces src/lib/brand-identity.ts with the same "on" module the Crease preview build uses, so the iPhone review
// shows exactly the proposed brand placements.
export * from '../../../src/lib/brand-identity.on';
