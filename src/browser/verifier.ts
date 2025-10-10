/**
 * Browser entry point for UBB Claim Verifier
 * Exports UBBOpReturnData class for verifying UBB transaction hex data
 */

import { UBBOpReturnData } from '../transactions/ubb-op-return-data';
import { UBBBMP } from '../ubb-bmp';

// Expose to global window object for browser usage
declare const window: any;
if (typeof window !== 'undefined') {
  window.UBBVerifier = {
    UBBOpReturnData,
    UBBBMP
  };
}

export { UBBOpReturnData, UBBBMP };
