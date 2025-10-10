import { encode as cborEncode } from 'cbor-x';
import { UBBBMP } from '../ubb-bmp';
import { UBBPlot } from '../ubb-plot';

/**
 * Result type for CLAIM OP_RETURN builder
 */
export type ClaimBuildResult = 
  | { ok: true; hex: string }
  | { ok: false; errors: { x?: string[]; y?: string[]; uri?: string[]; bmp?: string[] } };

/**
 * Builds a CLAIM transaction OP_RETURN payload as hex
 * 
 * Validates all inputs according to UBB protocol rules:
 * - x, y: must be integers in [0, 65535]
 * - bmpHex: must be valid hex encoding a valid 24/32-bit uncompressed BMP
 * - uri: defaults to empty string; must be a valid string
 * - placement: the plot must fit within the 65536×65536 canvas
 * 
 * @param x X coordinate (0-65535)
 * @param y Y coordinate (0-65535)
 * @param bmpHex BMP file as hex string (no 0x prefix)
 * @returns ClaimBuildResult with hex or errors
 */
export function buildClaimOpReturnHex(x: number, y: number, bmpHex: string): ClaimBuildResult;

/**
 * Builds a CLAIM transaction OP_RETURN payload as hex with URI
 * 
 * @param x X coordinate (0-65535)
 * @param y Y coordinate (0-65535)
 * @param uri URI string (can be empty)
 * @param bmpHex BMP file as hex string (no 0x prefix)
 * @returns ClaimBuildResult with hex or errors
 */
export function buildClaimOpReturnHex(x: number, y: number, uri: string, bmpHex: string): ClaimBuildResult;

// Implementation
export function buildClaimOpReturnHex(
  x: number,
  y: number,
  uriOrBmpHex: string,
  maybeBmpHex?: string
): ClaimBuildResult {
  // Determine which overload was called
  const uri = maybeBmpHex !== undefined ? uriOrBmpHex : '';
  const bmpHex = maybeBmpHex !== undefined ? maybeBmpHex : uriOrBmpHex;

  const errors: { x?: string[]; y?: string[]; uri?: string[]; bmp?: string[] } = {};

  // Validate X coordinate
  const xErrors = validateCoordinate(x, 'x');
  if (xErrors.length > 0) {
    errors.x = xErrors;
  }

  // Validate Y coordinate
  const yErrors = validateCoordinate(y, 'y');
  if (yErrors.length > 0) {
    errors.y = yErrors;
  }

  // Validate URI
  const uriErrors = validateUri(uri);
  if (uriErrors.length > 0) {
    errors.uri = uriErrors;
  }

  // Validate BMP hex and decode
  let bmpBuffer: Buffer | null = null;
  let ubbbmp: UBBBMP | null = null;
  const bmpHexErrors = validateBmpHex(bmpHex);
  
  if (bmpHexErrors.length > 0) {
    errors.bmp = bmpHexErrors;
  } else {
    // Decode hex to buffer
    try {
      bmpBuffer = Buffer.from(bmpHex, 'hex');
      
      // Validate BMP format
      ubbbmp = new UBBBMP(bmpBuffer);
      if (!ubbbmp.isValid) {
        errors.bmp = [...ubbbmp.validationErrors];
      }
    } catch (error) {
      errors.bmp = [`Failed to decode BMP: ${error instanceof Error ? error.message : 'Unknown error'}`];
    }
  }

  // Validate placement (bounds check) if we have valid inputs
  if (ubbbmp && ubbbmp.isValid && !errors.x && !errors.y) {
    const plot = new UBBPlot(ubbbmp, x, y);
    if (!plot.isValid) {
      const placementErrors = [...plot.validationErrors];
      if (placementErrors.length > 0) {
        // Attach placement errors to both x and y
        errors.x = [...(errors.x || []), ...placementErrors];
        errors.y = [...(errors.y || []), ...placementErrors];
      }
    }
  }

  // If any errors, return them
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  // Build the OP_RETURN payload
  try {
    const payload = buildPayload(x, y, uri, bmpBuffer!);
    return { ok: true, hex: payload.toString('hex') };
  } catch (error) {
    return {
      ok: false,
      errors: {
        bmp: [`Failed to build payload: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    };
  }
}

/**
 * Validates a coordinate (x or y)
 */
function validateCoordinate(coord: number, name: string): string[] {
  const errors: string[] = [];

  if (typeof coord !== 'number') {
    errors.push(`${name} must be a number`);
    return errors;
  }

  if (!Number.isFinite(coord)) {
    errors.push(`${name} must be a finite number`);
    return errors;
  }

  if (!Number.isInteger(coord)) {
    errors.push(`${name} must be an integer`);
  }

  if (coord < 0) {
    errors.push(`${name} must be non-negative (got ${coord})`);
  }

  if (coord > 65535) {
    errors.push(`${name} must be at most 65535 (got ${coord})`);
  }

  return errors;
}

/**
 * Validates a URI string
 */
function validateUri(uri: string): string[] {
  const errors: string[] = [];

  if (typeof uri !== 'string') {
    errors.push('URI must be a string');
  }

  return errors;
}

/**
 * Validates BMP hex string
 */
function validateBmpHex(bmpHex: string): string[] {
  const errors: string[] = [];

  if (typeof bmpHex !== 'string') {
    errors.push('BMP hex must be a string');
    return errors;
  }

  if (bmpHex.length === 0) {
    errors.push('BMP hex must not be empty');
    return errors;
  }

  if (bmpHex.length % 2 !== 0) {
    errors.push('BMP hex must have even length');
  }

  if (!/^[0-9a-fA-F]*$/.test(bmpHex)) {
    errors.push('BMP hex contains invalid characters (must be 0-9, a-f, A-F)');
  }

  return errors;
}

/**
 * Builds the complete OP_RETURN payload
 * Format: [0x13,0x37] | [0x01] | [0x01] | xLE(2) | yLE(2) | CBOR(uri) | BMP(...)
 */
function buildPayload(x: number, y: number, uri: string, bmpBuffer: Buffer): Buffer {
  // Magic bytes
  const magic = Buffer.from([0x13, 0x37]);
  
  // Version
  const version = Buffer.from([0x01]);
  
  // Transaction type (CLAIM = 0x01)
  const txType = Buffer.from([0x01]);
  
  // Coordinates (little-endian 16-bit)
  const xBuffer = Buffer.allocUnsafe(2);
  xBuffer.writeUInt16LE(x, 0);
  
  const yBuffer = Buffer.allocUnsafe(2);
  yBuffer.writeUInt16LE(y, 0);
  
  // URI (CBOR-encoded text string)
  const uriBuffer = cborEncode(uri);
  
  // Concatenate all parts
  return Buffer.concat([
    magic,
    version,
    txType,
    xBuffer,
    yBuffer,
    uriBuffer,
    bmpBuffer
  ]);
}
