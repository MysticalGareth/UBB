/**
 * Browser entry point for UBB Claim Builder
 * Exports buildClaimOpReturnHex function for use in browser
 */

import { buildClaimOpReturnHex, ClaimBuildResult } from '../transactions/build-claim-opreturn';

// Expose to global window object for browser usage
declare const window: any;
if (typeof window !== 'undefined') {
  window.UBBClaimBuilder = {
    buildClaimOpReturnHex
  };
}

export { buildClaimOpReturnHex };
export type { ClaimBuildResult };
