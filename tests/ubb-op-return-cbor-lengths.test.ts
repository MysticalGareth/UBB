import { UBBOpReturnData } from '../src/transactions';
import { encode as cborEncode } from 'cbor-x';

describe('UBBOpReturnData CBOR text string length handling', () => {
  /**
   * Helper to create a CLAIM OP_RETURN with a URI of specific length
   */
  function createClaimWithUri(uri: string): Buffer {
    const cborUri = cborEncode(uri);
    return Buffer.concat([
      Buffer.from([0x13, 0x37]), // Magic bytes
      Buffer.from([0x01]),       // Version
      Buffer.from([0x01]),       // Transaction type (CLAIM)
      Buffer.from([0x00, 0x00]), // X coordinate (0)
      Buffer.from([0x00, 0x00]), // Y coordinate (0)
      cborUri,                   // URI as CBOR text
      Buffer.from('BMP')         // Minimal BMP data
    ]);
  }

  describe('CBOR additional info 0-23 (inline length)', () => {
    test('should handle empty string (length 0)', () => {
      const uri = '';
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      expect(parsed.bmpData).toEqual(Buffer.from('BMP'));
    });

    test('should handle 1-character string', () => {
      const uri = 'a';
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
    });

    test('should handle 5-character string', () => {
      const uri = 'hello';
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
    });

    test('should handle 23-character string (max inline)', () => {
      const uri = '12345678901234567890123'; // exactly 23 chars
      expect(uri.length).toBe(23);
      
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      
      // Verify CBOR encoding uses inline length (additional info = 23)
      const cborUri = cborEncode(uri);
      expect(cborUri[0] & 0x1f).toBe(23); // Additional info should be 23
      expect(cborUri.length).toBe(24); // 1-byte header + 23 chars
    });
  });

  describe('CBOR additional info 24 (1-byte length)', () => {
    test('should handle 24-character string (min for 1-byte length)', () => {
      const uri = '123456789012345678901234'; // exactly 24 chars
      expect(uri.length).toBe(24);
      
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      
      // Verify CBOR encoding uses 1-byte length (additional info = 24)
      const cborUri = cborEncode(uri);
      expect(cborUri[0] & 0x1f).toBe(24); // Additional info should be 24
      expect(cborUri[1]).toBe(24); // Length byte should be 24
      expect(cborUri.length).toBe(26); // 2-byte header + 24 chars
    });

    test('should handle 100-character string', () => {
      const uri = 'x'.repeat(100);
      expect(uri.length).toBe(100);
      
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      
      const cborUri = cborEncode(uri);
      expect(cborUri[0] & 0x1f).toBe(24);
      expect(cborUri[1]).toBe(100);
    });

    test('should handle 255-character string (max for 1-byte length)', () => {
      const uri = 'x'.repeat(255);
      expect(uri.length).toBe(255);
      
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      
      // Verify CBOR encoding uses 1-byte length
      const cborUri = cborEncode(uri);
      expect(cborUri[0] & 0x1f).toBe(24);
      expect(cborUri[1]).toBe(255);
      expect(cborUri.length).toBe(257); // 2-byte header + 255 chars
    });
  });

  describe('CBOR additional info 25 (2-byte length)', () => {
    test('should handle 256-character string (min for 2-byte length)', () => {
      const uri = 'x'.repeat(256);
      expect(uri.length).toBe(256);
      
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      
      // Verify CBOR encoding uses 2-byte length (additional info = 25)
      const cborUri = cborEncode(uri);
      expect(cborUri[0] & 0x1f).toBe(25); // Additional info should be 25
      expect(cborUri.readUInt16BE(1)).toBe(256); // Length should be 256
      expect(cborUri.length).toBe(259); // 3-byte header + 256 chars
    });

    test('should handle 1000-character string', () => {
      const uri = 'x'.repeat(1000);
      expect(uri.length).toBe(1000);
      
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      
      const cborUri = cborEncode(uri);
      expect(cborUri[0] & 0x1f).toBe(25);
      expect(cborUri.readUInt16BE(1)).toBe(1000);
    });

    test('should handle 65535-character string (max for 2-byte length)', () => {
      const uri = 'x'.repeat(65535);
      expect(uri.length).toBe(65535);
      
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      
      // Verify CBOR encoding uses 2-byte length
      const cborUri = cborEncode(uri);
      expect(cborUri[0] & 0x1f).toBe(25);
      expect(cborUri.readUInt16BE(1)).toBe(65535);
      expect(cborUri.length).toBe(65538); // 3-byte header + 65535 chars
    });
  });

  describe('CBOR additional info 26 (4-byte length)', () => {
    test('should handle 65536-character string (min for 4-byte length)', () => {
      const uri = 'x'.repeat(65536);
      expect(uri.length).toBe(65536);
      
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      expect(parsed.uri?.length).toBe(65536);
      
      // Verify CBOR encoding uses 4-byte length (additional info = 26)
      const cborUri = cborEncode(uri);
      expect(cborUri[0] & 0x1f).toBe(26); // Additional info should be 26
      expect(cborUri.readUInt32BE(1)).toBe(65536); // Length should be 65536
      expect(cborUri.length).toBe(65541); // 5-byte header + 65536 chars
    });

    test('should handle 100000-character string', () => {
      const uri = 'x'.repeat(100000);
      expect(uri.length).toBe(100000);
      
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      
      const cborUri = cborEncode(uri);
      expect(cborUri[0] & 0x1f).toBe(26);
      expect(cborUri.readUInt32BE(1)).toBe(100000);
    });
  });

  describe('Real-world URI examples with trailing BMP data', () => {
    test('should handle typical IPFS URI with large BMP', () => {
      const uri = 'ipfs://QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
      const bmp = Buffer.alloc(50000); // Large BMP
      bmp.write('BM'); // BMP signature
      
      const cborUri = cborEncode(uri);
      const opReturn = Buffer.concat([
        Buffer.from([0x13, 0x37, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00]),
        cborUri,
        bmp
      ]);
      
      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      expect(parsed.bmpData?.subarray(0, 2)).toEqual(Buffer.from('BM'));
      expect(parsed.bmpData?.length).toBe(50000);
    });

    test('should handle HTTP URI', () => {
      const uri = 'https://example.com/very/long/path/to/image.png?with=query&params=123';
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
    });

    test('should handle data URI', () => {
      const uri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const opReturn = createClaimWithUri(uri);
      const parsed = new UBBOpReturnData(opReturn);

      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
    });
  });

  describe('Edge cases and boundary conditions', () => {
    test('should correctly separate URI from BMP when BMP starts with text-like bytes', () => {
      const uri = 'test';
      const cborUri = cborEncode(uri);
      // Create BMP data that starts with bytes that could look like CBOR
      const bmp = Buffer.from([0x78, 0x19, 0x42, 0x4D]); // Starts with 0x78 (CBOR text marker)
      
      const opReturn = Buffer.concat([
        Buffer.from([0x13, 0x37, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00]),
        cborUri,
        bmp
      ]);
      
      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      expect(parsed.bmpData).toEqual(bmp);
    });

    test('should handle URI at boundary transitions', () => {
      const testLengths = [23, 24, 255, 256, 65535, 65536];
      
      for (const length of testLengths) {
        const uri = 'x'.repeat(length);
        const opReturn = createClaimWithUri(uri);
        const parsed = new UBBOpReturnData(opReturn);
        
        expect(parsed.isValid).toBe(true);
        expect(parsed.uri).toBe(uri);
        expect(parsed.uri?.length).toBe(length);
      }
    });
  });
});
