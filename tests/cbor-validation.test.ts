/**
 * Comprehensive CBOR validation tests for UBB OP_RETURN data
 * Tests all major types, malformed data, and edge cases
 */

import { UBBOpReturnData } from '../src/transactions';
import { encode as cborEncode } from 'cbor-x';

describe('CBOR Major Types Validation', () => {
  /**
   * Helper to create OP_RETURN with custom CBOR data
   */
  function createOpReturnWithCBOR(cborData: Buffer): Buffer {
    return Buffer.concat([
      Buffer.from([0x13, 0x37]), // Magic bytes
      Buffer.from([0x01]),       // Version
      Buffer.from([0x01]),       // Transaction type (CLAIM)
      Buffer.from([0x00, 0x00]), // X coordinate (0)
      Buffer.from([0x00, 0x00]), // Y coordinate (0)
      cborData,                  // Custom CBOR data
      Buffer.from('BMP')         // Minimal BMP data
    ]);
  }

  describe('Major Type 3 (Text String) - Valid', () => {
    test('should accept valid text string', () => {
      const uri = 'https://example.com';
      const cbor = cborEncode(uri);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
    });

    test('should accept empty text string', () => {
      const uri = '';
      const cbor = cborEncode(uri);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe('');
    });

    test('should accept text with special characters', () => {
      const uri = 'https://example.com/文字/émoji/🔥';
      const cbor = cborEncode(uri);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
    });
  });

  describe('Major Type 0 (Unsigned Integer) - Invalid', () => {
    test('should reject unsigned integer as URI', () => {
      const cbor = cborEncode(12345);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });

    test('should reject zero as URI', () => {
      const cbor = cborEncode(0);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });

    test('should reject large integer as URI', () => {
      const cbor = cborEncode(0xFFFFFFFF);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });
  });

  describe('Major Type 1 (Negative Integer) - Invalid', () => {
    test('should reject negative integer as URI', () => {
      const cbor = cborEncode(-1);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });

    test('should reject large negative integer as URI', () => {
      const cbor = cborEncode(-1000000);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });
  });

  describe('Major Type 2 (Byte String) - Invalid', () => {
    test('should reject byte string as URI', () => {
      const byteString = Buffer.from('hello');
      const cbor = Buffer.concat([
        Buffer.from([0x45]), // Major type 2, length 5
        byteString
      ]);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });

    test('should reject empty byte string as URI', () => {
      const cbor = Buffer.from([0x40]); // Major type 2, length 0
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });
  });

  describe('Major Type 4 (Array) - Invalid', () => {
    test('should reject array as URI', () => {
      const cbor = cborEncode(['hello', 'world']);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });

    test('should reject empty array as URI', () => {
      const cbor = cborEncode([]);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });
  });

  describe('Major Type 5 (Map) - Invalid', () => {
    test('should reject map as URI', () => {
      const cbor = cborEncode({ url: 'https://example.com' });
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });

    test('should reject empty map as URI', () => {
      const cbor = cborEncode({});
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });
  });

  describe('Major Type 7 (Simple Values/Floats) - Invalid', () => {
    test('should reject boolean true as URI', () => {
      const cbor = cborEncode(true);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });

    test('should reject boolean false as URI', () => {
      const cbor = cborEncode(false);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });

    test('should reject null as URI', () => {
      const cbor = cborEncode(null);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });

    test('should reject undefined as URI', () => {
      const cbor = cborEncode(undefined);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });

    test('should reject float as URI', () => {
      const cbor = cborEncode(3.14159);
      const opReturn = createOpReturnWithCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });
  });
});

describe('Malformed and Truncated CBOR', () => {
function createOpReturnWithRawCBOR(cborData: Buffer): Buffer {
    return Buffer.concat([
      Buffer.from([0x13, 0x37, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00]),
      cborData,
      Buffer.from('BMP')
    ]);
  }

  describe('Truncated length indicators', () => {
    test('should reject truncated 1-byte length', () => {
      const cbor = Buffer.from([0x78]); // Text string with 1-byte length, but length byte missing
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });

    test('should reject truncated 2-byte length', () => {
      const cbor = Buffer.from([0x79, 0x01]); // Text string with 2-byte length, but incomplete
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });

    test('should reject truncated 4-byte length', () => {
      const cbor = Buffer.from([0x7A, 0x00, 0x01]); // Text string with 4-byte length, but incomplete
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });
  });

  describe('Truncated text content', () => {
    test('should reject text string with length > available data (inline)', () => {
      const cbor = Buffer.from([0x65, 0x68, 0x65]); // Says 5 bytes but only 2 provided
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });

    test('should reject text string with length > available data (1-byte)', () => {
      const cbor = Buffer.from([0x78, 0x10, 0x68, 0x65, 0x6C, 0x6C]); // Says 16 bytes but only 4 provided
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });

    test('should reject text string with length > available data (2-byte)', () => {
      const cbor = Buffer.from([0x79, 0x01, 0x00, 0x68, 0x69]); // Says 256 bytes but only 2 provided
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });
  });

  describe('Invalid CBOR structure', () => {
    test('should reject completely empty CBOR section', () => {
      const cbor = Buffer.alloc(0);
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });

    test('should reject invalid initial byte', () => {
      const cbor = Buffer.from([0xFF]); // Reserved/invalid
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });

    test('should reject invalid UTF-8 in text string', () => {
      const cbor = Buffer.from([
        0x64, // Text string, length 4
        0xFF, 0xFE, 0xFD, 0xFC // Invalid UTF-8 bytes
      ]);
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: invalid UTF-8 encoding in text string');
    });
  });

  describe('Reserved additional info values', () => {
    test('should handle additional info 28 (reserved)', () => {
      const cbor = Buffer.from([0x7C]); // Major type 3, additional info 28 (reserved)
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      // Should fail - reserved values are invalid
      expect(parsed.isValid).toBe(false);
    });

    test('should handle additional info 29 (reserved)', () => {
      const cbor = Buffer.from([0x7D]); // Major type 3, additional info 29 (reserved)
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });

    test('should handle additional info 30 (reserved)', () => {
      const cbor = Buffer.from([0x7E]); // Major type 3, additional info 30 (reserved)
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });
  });

  describe('Null byte rejection', () => {
    test('should reject URI containing null bytes', () => {
      // Create a CBOR text string with null bytes embedded
      const uriWithNull = 'https://example.com\0/path';
      const cborUri = Buffer.concat([
        Buffer.from([0x78, uriWithNull.length]), // CBOR text string header
        Buffer.from(uriWithNull, 'utf8')
      ]);
      const opReturn = createOpReturnWithRawCBOR(cborUri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors.some(e => e.includes('null byte'))).toBe(true);
    });

    test('should reject URI with null byte at start', () => {
      const uriWithNull = '\0https://example.com';
      const cborUri = Buffer.concat([
        Buffer.from([0x78, uriWithNull.length]),
        Buffer.from(uriWithNull, 'utf8')
      ]);
      const opReturn = createOpReturnWithRawCBOR(cborUri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors.some(e => e.includes('null byte'))).toBe(true);
    });

    test('should reject URI with null byte at end', () => {
      const uriWithNull = 'https://example.com\0';
      const cborUri = Buffer.concat([
        Buffer.from([0x78, uriWithNull.length]),
        Buffer.from(uriWithNull, 'utf8')
      ]);
      const opReturn = createOpReturnWithRawCBOR(cborUri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors.some(e => e.includes('null byte'))).toBe(true);
    });

    test('should accept URI without null bytes', () => {
      const uri = 'https://example.com/path?query=value';
      const cborUri = Buffer.concat([
        Buffer.from([0x78, uri.length]),
        Buffer.from(uri, 'utf8')
      ]);
      const opReturn = createOpReturnWithRawCBOR(cborUri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
    });

    test('should accept empty URI (no null bytes)', () => {
      const cborUri = Buffer.from([0x60]); // CBOR empty text string
      const opReturn = createOpReturnWithRawCBOR(cborUri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe('');
    });
  });

  describe('Indefinite-length strings (MUST be rejected)', () => {
    test('should reject indefinite-length text string', () => {
      // CBOR indefinite-length text: 0x7F (start) + chunks + 0xFF (break)
      const cbor = Buffer.concat([
        Buffer.from([0x7F]),           // Indefinite-length text string
        Buffer.from([0x64]),           // Chunk: text string, length 4
        Buffer.from('test'),
        Buffer.from([0x65]),           // Chunk: text string, length 5
        Buffer.from('hello'),
        Buffer.from([0xFF])            // Break
      ]);
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      // Per UBB spec: indefinite-length CBOR strings are explicitly forbidden
      expect(parsed.isValid).toBe(false);
      expect(parsed.errors.some(e => 
        e.includes('failed to parse string length') || 
        e.includes('CBOR text')
      )).toBe(true);
    });

    test('should reject empty indefinite-length text string', () => {
      const cbor = Buffer.from([0x7F, 0xFF]); // Start + immediate break
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      // Per UBB spec: indefinite-length CBOR strings are explicitly forbidden
      expect(parsed.isValid).toBe(false);
    });

    test('should reject unterminated indefinite-length string', () => {
      const cbor = Buffer.concat([
        Buffer.from([0x7F]),           // Indefinite-length text string
        Buffer.from([0x64]),           // Chunk: text string, length 4
        Buffer.from('test')
        // Missing 0xFF break!
      ]);
      const opReturn = createOpReturnWithRawCBOR(cbor);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(false);
    });
  });
});

describe('CBOR Edge Cases and Boundaries', () => {
  function createOpReturnWithCBOR(cborData: Buffer): Buffer {
    return Buffer.concat([
      Buffer.from([0x13, 0x37, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00]),
      cborData,
      Buffer.from('BMP')
    ]);
  }

  test('should handle text string with all ASCII characters', () => {
    const uri = String.fromCharCode(...Array.from({ length: 95 }, (_, i) => i + 32)); // ASCII 32-126
    const cbor = cborEncode(uri);
    const opReturn = createOpReturnWithCBOR(cbor);
    const parsed = new UBBOpReturnData(opReturn);

    expect(parsed.isValid).toBe(true);
    expect(parsed.uri).toBe(uri);
  });

  test('should reject text with null character (\\0)', () => {
    const uri = 'hello\x00world';
    const cbor = cborEncode(uri);
    const opReturn = createOpReturnWithCBOR(cbor);
    const parsed = new UBBOpReturnData(opReturn);

    // Per UBB spec: null bytes are forbidden in URIs
    expect(parsed.isValid).toBe(false);
    expect(parsed.errors.some(e => e.includes('null byte'))).toBe(true);
  });

  test('should handle text with newlines and tabs', () => {
    const uri = 'line1\nline2\tline3\r\nline4';
    const cbor = cborEncode(uri);
    const opReturn = createOpReturnWithCBOR(cbor);
    const parsed = new UBBOpReturnData(opReturn);

    expect(parsed.isValid).toBe(true);
    expect(parsed.uri).toBe(uri);
  });

  test('should handle maximum inline length exactly', () => {
    const uri = 'a'.repeat(23);
    const cbor = cborEncode(uri);
    
    // Verify it uses inline encoding
    expect((cbor[0] & 0x1F)).toBe(23);
    
    const opReturn = createOpReturnWithCBOR(cbor);
    const parsed = new UBBOpReturnData(opReturn);

    expect(parsed.isValid).toBe(true);
    expect(parsed.uri).toBe(uri);
  });

  test('should handle minimum 1-byte length exactly', () => {
    const uri = 'a'.repeat(24);
    const cbor = cborEncode(uri);
    
    // Verify it uses 1-byte encoding
    expect((cbor[0] & 0x1F)).toBe(24);
    expect(cbor[1]).toBe(24);
    
    const opReturn = createOpReturnWithCBOR(cbor);
    const parsed = new UBBOpReturnData(opReturn);

    expect(parsed.isValid).toBe(true);
    expect(parsed.uri).toBe(uri);
  });

  test('should handle multi-byte UTF-8 characters', () => {
    const uri = '😀😁😂🤣😃😄'; // Each emoji is 4 bytes in UTF-8
    const cbor = cborEncode(uri);
    const opReturn = createOpReturnWithCBOR(cbor);
    const parsed = new UBBOpReturnData(opReturn);

    expect(parsed.isValid).toBe(true);
    expect(parsed.uri).toBe(uri);
  });

  test('should handle text with combining characters', () => {
    const uri = 'é̃';  // 'e' + combining acute + combining tilde
    const cbor = cborEncode(uri);
    const opReturn = createOpReturnWithCBOR(cbor);
    const parsed = new UBBOpReturnData(opReturn);

    expect(parsed.isValid).toBe(true);
    expect(parsed.uri).toBe(uri);
  });

  test('should handle right-to-left text', () => {
    const uri = 'مرحبا بالعالم'; // Arabic "Hello World"
    const cbor = cborEncode(uri);
    const opReturn = createOpReturnWithCBOR(cbor);
    const parsed = new UBBOpReturnData(opReturn);

    expect(parsed.isValid).toBe(true);
    expect(parsed.uri).toBe(uri);
  });
});
