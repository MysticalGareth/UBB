/**
 * Parses and validates UBB OP_RETURN data
 * 
 * UBB OP_RETURN format:
 * - Magic bytes: 0x13 0x37 (2 bytes)
 * - Version: 0x01 (1 byte)
 * - Transaction type: 1 byte (0x01=CLAIM, 0x02=RETRY-CLAIM, 0x03=UPDATE, 0x04=TRANSFER)
 * - X coordinate: 2 bytes (little-endian)
 * - Y coordinate: 2 bytes (little-endian)
 * - For CLAIM/UPDATE: URI (CBOR text string) immediately after y0
 * - BMP data: variable length (only for CLAIM and UPDATE), immediately after URI
 */
import { Decoder, encode as cborEncode } from 'cbor-x';

/**
 * Validates that a buffer contains valid UTF-8 encoding
 * Returns true if valid, false otherwise
 */
function isValidUTF8(buffer: Buffer): boolean {
  let i = 0;
  while (i < buffer.length) {
    const byte = buffer[i];
    
    // 1-byte sequence (0xxxxxxx)
    if (byte <= 0x7F) {
      i += 1;
      continue;
    }
    
    // 2-byte sequence (110xxxxx 10xxxxxx)
    if ((byte & 0xE0) === 0xC0) {
      if (i + 1 >= buffer.length) return false;
      if ((buffer[i + 1] & 0xC0) !== 0x80) return false;
      // Check for overlong encoding
      if (byte < 0xC2) return false;
      i += 2;
      continue;
    }
    
    // 3-byte sequence (1110xxxx 10xxxxxx 10xxxxxx)
    if ((byte & 0xF0) === 0xE0) {
      if (i + 2 >= buffer.length) return false;
      if ((buffer[i + 1] & 0xC0) !== 0x80) return false;
      if ((buffer[i + 2] & 0xC0) !== 0x80) return false;
      // Check for overlong encoding and surrogates
      const codePoint = ((byte & 0x0F) << 12) | ((buffer[i + 1] & 0x3F) << 6) | (buffer[i + 2] & 0x3F);
      if (codePoint < 0x800) return false; // Overlong
      if (codePoint >= 0xD800 && codePoint <= 0xDFFF) return false; // Surrogate pairs
      i += 3;
      continue;
    }
    
    // 4-byte sequence (11110xxx 10xxxxxx 10xxxxxx 10xxxxxx)
    if ((byte & 0xF8) === 0xF0) {
      if (i + 3 >= buffer.length) return false;
      if ((buffer[i + 1] & 0xC0) !== 0x80) return false;
      if ((buffer[i + 2] & 0xC0) !== 0x80) return false;
      if ((buffer[i + 3] & 0xC0) !== 0x80) return false;
      // Check for overlong encoding and valid Unicode range
      const codePoint = ((byte & 0x07) << 18) | ((buffer[i + 1] & 0x3F) << 12) | 
                       ((buffer[i + 2] & 0x3F) << 6) | (buffer[i + 3] & 0x3F);
      if (codePoint < 0x10000) return false; // Overlong
      if (codePoint > 0x10FFFF) return false; // Beyond Unicode
      i += 4;
      continue;
    }
    
    // Invalid UTF-8 byte
    return false;
  }
  
  return true;
}

export class UBBOpReturnData {
  private _magicBytes: Buffer;
  private _version: number;
  private _transactionType: number;
  private _x0: number;
  private _y0: number;
  private _bmpData: Buffer | null;
  private readonly _rawData: Buffer;
  private _isValid: boolean;
  private _errors: string[];
  private _uri: string | null;

  constructor(opReturnData: Buffer) {
    this._rawData = opReturnData;
    this._errors = [];
    
    // Initialize with default values
    this._magicBytes = Buffer.alloc(0);
    this._version = 0;
    this._transactionType = 0;
    this._x0 = 0;
    this._y0 = 0;
    this._bmpData = null;
    this._isValid = false;
    this._uri = null;
    
    try {
      this._parseOpReturnData(opReturnData);
      this._isValid = this._errors.length === 0;
    } catch (error) {
      this._errors.push(`Failed to parse OP_RETURN data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this._isValid = false;
    }
  }

  /**
   * Whether the OP_RETURN data is valid
   */
  get isValid(): boolean {
    return this._isValid;
  }

  /**
   * Array of parsing errors
   */
  get errors(): readonly string[] {
    return this._errors;
  }

  /**
   * Magic bytes (0x13 0x37)
   */
  get magicBytes(): Buffer {
    return this._magicBytes;
  }

  /**
   * Version number
   */
  get version(): number {
    return this._version;
  }

  /**
   * Transaction type (1=CLAIM, 2=RETRY-CLAIM, 3=UPDATE, 4=TRANSFER)
   */
  get transactionType(): number {
    return this._transactionType;
  }

  /**
   * Transaction type as string
   */
  get transactionTypeString(): string {
    switch (this._transactionType) {
      case 0x01: return 'CLAIM';
      case 0x02: return 'RETRY-CLAIM';
      case 0x03: return 'UPDATE';
      case 0x04: return 'TRANSFER';
      default: return 'UNKNOWN';
    }
  }

  /**
   * X coordinate
   */
  get x0(): number {
    return this._x0;
  }

  /**
   * Y coordinate
   */
  get y0(): number {
    return this._y0;
  }

  /**
   * BMP data (only for CLAIM and UPDATE transactions)
   */
  get bmpData(): Buffer | null {
    return this._bmpData;
  }

  /**
   * Optional URI string (present when flags bit 0 set on CLAIM/UPDATE)
   */
  get uri(): string | null {
    return this._uri;
  }

  /**
   * Raw OP_RETURN data
   */
  get rawData(): Buffer {
    return this._rawData;
  }

  /**
   * Whether this is a CLAIM transaction
   */
  get isClaim(): boolean {
    return this._transactionType === 0x01;
  }

  /**
   * Whether this is a RETRY-CLAIM transaction
   */
  get isRetryClaim(): boolean {
    return this._transactionType === 0x02;
  }

  /**
   * Whether this is an UPDATE transaction
   */
  get isUpdate(): boolean {
    return this._transactionType === 0x03;
  }

  /**
   * Whether this is a TRANSFER transaction
   */
  get isTransfer(): boolean {
    return this._transactionType === 0x04;
  }

  /**
   * Whether this transaction type requires BMP data
   */
  get requiresBmpData(): boolean {
    return this.isClaim || this.isUpdate;
  }

  /**
   * Whether this transaction type requires coordinates
   */
  get requiresCoordinates(): boolean {
    return this.isClaim || this.isRetryClaim || this.isUpdate;
  }

  private _parseOpReturnData(data: Buffer): void {
    // Minimum 8 bytes (magic[2] + version[1] + type[1] + x0[2] + y0[2])
    if (data.length < 8) {
      this._errors.push('OP_RETURN data too short (minimum 8 bytes required)');
      return;
    }

    let offset = 0;

    // Parse magic bytes (2 bytes)
    const magicBytes = data.subarray(offset, offset + 2);
    offset += 2;

    if (!magicBytes.equals(Buffer.from([0x13, 0x37]))) {
      this._errors.push(`Invalid magic bytes: expected 0x13 0x37, got 0x${magicBytes.toString('hex')}`);
    }

    // Parse version (1 byte)
    const version = data.readUInt8(offset);
    offset += 1;

    if (version !== 0x01) {
      this._errors.push(`Unsupported version: expected 0x01, got 0x${version.toString(16).padStart(2, '0')}`);
    }

    // Parse transaction type (1 byte)
    const transactionType = data.readUInt8(offset);
    offset += 1;

    if (transactionType < 0x01 || transactionType > 0x04) {
      this._errors.push(`Invalid transaction type: ${transactionType}`);
    }

    // No flags. Next are coordinates.

    // Parse coordinates (4 bytes total: 2 for X, 2 for Y)
    const x0 = data.readUInt16LE(offset);
    offset += 2;
    const y0 = data.readUInt16LE(offset);
    offset += 2;

    // Required URI for CLAIM/UPDATE: CBOR text string immediately after y0
    let uri: string | null = null;
    if (transactionType === 0x01 || transactionType === 0x03) {
      try {
        const slice = data.subarray(offset);
        if (slice.length === 0) {
          this._errors.push('Failed to decode CBOR text string for URI: empty buffer');
        } else {
          const majorType = slice[0] >>> 5;
          if (majorType !== 3) {
            this._errors.push('CBOR text: expected major type 3 (text string)');
          } else {
            // Parse CBOR text string header to determine total byte length
            // then use cbor-x Decoder to decode just that portion
            const cborLength = this._getCBORTextStringLength(slice);
            if (cborLength === -1) {
              this._errors.push('CBOR text: failed to parse string length from header');
            } else {
              // Extract just the CBOR portion and decode with cbor-x
              const cborPortion = slice.subarray(0, cborLength);
              
              // First, validate the raw UTF-8 bytes before decoding
              // Extract the text content bytes (skip CBOR header)
              const { textBytes, headerLength } = this._extractCBORTextBytes(cborPortion);
              if (textBytes && !isValidUTF8(textBytes)) {
                this._errors.push('CBOR text: invalid UTF-8 encoding in text string');
              } else {
                // Decode with cbor-x
                const decoder = new Decoder();
                const decodedValue = decoder.decode(cborPortion);
                
                if (typeof decodedValue !== 'string') {
                  this._errors.push('CBOR text: expected a text string');
                } else {
                  // Check for null bytes in the decoded URI
                  if (decodedValue.includes('\0')) {
                    this._errors.push('CBOR text: URI must not contain null bytes');
                  } else {
                    uri = decodedValue;
                    offset += cborLength;
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        this._errors.push(`Failed to decode CBOR text string for URI: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    }

    // Parse BMP data (only for CLAIM and UPDATE)
    let bmpData: Buffer | null = null;
    const requiresBmpData = transactionType === 0x01 || transactionType === 0x03; // CLAIM or UPDATE
    
    if (requiresBmpData) {
      if (offset < data.length) {
        bmpData = data.subarray(offset);
        
        // Note: We don't validate BMP content here - that's done by UBBBMP class
        // The OP_RETURN parser just extracts the data
        // Empty BMP data is valid (length 0)
      } else if (offset === data.length) {
        // No BMP data provided at all - this is invalid for CLAIM and UPDATE
        const transactionTypeString = this._getTransactionTypeString(transactionType);
        this._errors.push(`${transactionTypeString} transaction requires BMP data`);
        bmpData = null;
      } else {
        // This shouldn't happen, but handle it
        const transactionTypeString = this._getTransactionTypeString(transactionType);
        this._errors.push(`${transactionTypeString} transaction requires BMP data`);
        bmpData = null;
      }
    }

    // Update the properties
    this._magicBytes = magicBytes;
    this._version = version;
    this._transactionType = transactionType;
    this._x0 = x0;
    this._y0 = y0;
    this._bmpData = bmpData;
    this._uri = uri;
  }

  /**
   * Extract the raw text bytes from a CBOR text string buffer
   * Returns the text content and header length
   */
  private _extractCBORTextBytes(buffer: Buffer): { textBytes: Buffer | null; headerLength: number } {
    if (buffer.length === 0) {
      return { textBytes: null, headerLength: 0 };
    }
    
    const firstByte = buffer[0];
    const majorType = firstByte >>> 5;
    
    if (majorType !== 3) {
      return { textBytes: null, headerLength: 0 };
    }
    
    const additionalInfo = firstByte & 0x1f;
    
    // Handle definite-length encodings per CBOR spec
    if (additionalInfo < 24) {
      // Length 0-23: encoded in low 5 bits of first byte
      const textLength = additionalInfo;
      const headerLength = 1;
      if (buffer.length < headerLength + textLength) {
        return { textBytes: null, headerLength: 0 };
      }
      return { 
        textBytes: buffer.subarray(headerLength, headerLength + textLength),
        headerLength
      };
    } else if (additionalInfo === 24) {
      // Length 24-255: next 1 byte contains length
      if (buffer.length < 2) {
        return { textBytes: null, headerLength: 0 };
      }
      const textLength = buffer[1];
      const headerLength = 2;
      if (buffer.length < headerLength + textLength) {
        return { textBytes: null, headerLength: 0 };
      }
      return {
        textBytes: buffer.subarray(headerLength, headerLength + textLength),
        headerLength
      };
    } else if (additionalInfo === 25) {
      // Length 256-65535: next 2 bytes contain length (big-endian)
      if (buffer.length < 3) {
        return { textBytes: null, headerLength: 0 };
      }
      const textLength = buffer.readUInt16BE(1);
      const headerLength = 3;
      if (buffer.length < headerLength + textLength) {
        return { textBytes: null, headerLength: 0 };
      }
      return {
        textBytes: buffer.subarray(headerLength, headerLength + textLength),
        headerLength
      };
    } else if (additionalInfo === 26) {
      // Length 65536-4294967295: next 4 bytes contain length (big-endian)
      if (buffer.length < 5) {
        return { textBytes: null, headerLength: 0 };
      }
      const textLength = buffer.readUInt32BE(1);
      const headerLength = 5;
      if (buffer.length < headerLength + textLength) {
        return { textBytes: null, headerLength: 0 };
      }
      return {
        textBytes: buffer.subarray(headerLength, headerLength + textLength),
        headerLength
      };
    }
    
    // Additional info 27 (8-byte length) or 31 (indefinite) not supported
    return { textBytes: null, headerLength: 0 };
  }

  /**
   * Parses CBOR definite-length text string header to determine total byte length
   * (header + string data). Returns -1 on error.
   * 
   * This reads the standard CBOR text string format (major type 3):
   * - Additional info 0-23: length in low 5 bits (1-byte header)
   * - Additional info 24: 1-byte length follows (2-byte header)
   * - Additional info 25: 2-byte length follows (3-byte header)
   * - Additional info 26: 4-byte length follows (5-byte header)
   * 
   * All actual CBOR encoding/decoding is delegated to cbor-x.
   */
  private _getCBORTextStringLength(buffer: Buffer): number {
    if (buffer.length === 0) return -1;
    
    const firstByte = buffer[0];
    const majorType = firstByte >>> 5;
    
    // Must be text string (major type 3)
    if (majorType !== 3) return -1;
    
    const additionalInfo = firstByte & 0x1f;
    
    // Handle definite-length encodings per CBOR spec
    if (additionalInfo < 24) {
      // Length 0-23: encoded in low 5 bits of first byte
      return 1 + additionalInfo;
    } else if (additionalInfo === 24) {
      // Length 24-255: next 1 byte contains length
      if (buffer.length < 2) return -1;
      const stringLength = buffer[1];
      return 2 + stringLength;
    } else if (additionalInfo === 25) {
      // Length 256-65535: next 2 bytes contain length (big-endian)
      if (buffer.length < 3) return -1;
      const stringLength = buffer.readUInt16BE(1);
      return 3 + stringLength;
    } else if (additionalInfo === 26) {
      // Length 65536-4294967295: next 4 bytes contain length (big-endian)
      if (buffer.length < 5) return -1;
      const stringLength = buffer.readUInt32BE(1);
      return 5 + stringLength;
    } else {
      // Additional info 27 (8-byte length) or 31 (indefinite) not supported
      return -1;
    }
  }

  private _getTransactionTypeString(transactionType: number): string {
    switch (transactionType) {
      case 0x01: return 'CLAIM';
      case 0x02: return 'RETRY-CLAIM';
      case 0x03: return 'UPDATE';
      case 0x04: return 'TRANSFER';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Creates UBBOpReturnData from raw OP_RETURN bytes
   */
  static fromOpReturnData(data: Buffer): UBBOpReturnData {
    return new UBBOpReturnData(data);
  }

  /**
   * Creates UBBOpReturnData from Bitcoin transaction's OP_RETURN output
   */
  static fromBitcoinTransaction(bitcoinTx: { opReturnData: Buffer | null }): UBBOpReturnData | null {
    if (!bitcoinTx.opReturnData) {
      return null;
    }
    return new UBBOpReturnData(bitcoinTx.opReturnData);
  }
}
