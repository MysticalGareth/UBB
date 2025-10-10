import { buildClaimOpReturnHex } from '../src/transactions';
import * as fs from 'fs';
import * as path from 'path';

describe('buildClaimOpReturnHex', () => {
  // Helper to create a minimal valid 24-bit BMP
  function createMinimalBMP(width: number, height: number): Buffer {
    const headerSize = 54;
    const bytesPerPixel = 3; // 24-bit
    const stride = Math.ceil((width * bytesPerPixel) / 4) * 4;
    const pixelDataSize = stride * height;
    const fileSize = headerSize + pixelDataSize;

    const buffer = Buffer.alloc(fileSize);
    
    // BMP Header (14 bytes)
    buffer.write('BM', 0); // Signature
    buffer.writeUInt32LE(fileSize, 2); // File size
    buffer.writeUInt32LE(0, 6); // Reserved
    buffer.writeUInt32LE(headerSize, 10); // Pixel data offset

    // DIB Header (40 bytes - BITMAPINFOHEADER)
    buffer.writeUInt32LE(40, 14); // DIB header size
    buffer.writeInt32LE(width, 18); // Width
    buffer.writeInt32LE(height, 22); // Height (positive = bottom-up)
    buffer.writeUInt16LE(1, 26); // Planes
    buffer.writeUInt16LE(24, 28); // Bits per pixel
    buffer.writeUInt32LE(0, 30); // Compression (BI_RGB)
    buffer.writeUInt32LE(pixelDataSize, 34); // Image size
    buffer.writeInt32LE(0, 38); // X pixels per meter
    buffer.writeInt32LE(0, 42); // Y pixels per meter
    buffer.writeUInt32LE(0, 46); // Colors used
    buffer.writeUInt32LE(0, 50); // Important colors

    // Pixel data (already zeroed)
    return buffer;
  }

  describe('Valid builds', () => {
    test('should build valid CLAIM with uncompressed_24.bmp', () => {
      const bmpPath = path.join(__dirname, 'fixtures', 'uncompressed_24.bmp');
      const bmpBuffer = fs.readFileSync(bmpPath);
      const bmpHex = bmpBuffer.toString('hex');

      const result = buildClaimOpReturnHex(0, 0, bmpHex);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Check magic, version, type
        expect(result.hex.startsWith('13370101')).toBe(true);
        // Check coordinates (0, 0) in little-endian
        expect(result.hex.substring(8, 16)).toBe('00000000');
        // Check it ends with BMP data (starts with 'BM' = 424d)
        expect(result.hex.includes('424d')).toBe(true);
      }
    });

    test('should build valid CLAIM with minimal BMP and empty URI', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(100, 200, '', bmpHex);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Check structure
        expect(result.hex.startsWith('1337')).toBe(true);
        expect(result.hex.substring(4, 8)).toBe('0101'); // version + type
        // x=100 (0x64), y=200 (0xc8) in little-endian
        expect(result.hex.substring(8, 12)).toBe('6400'); // x=100
        expect(result.hex.substring(12, 16)).toBe('c800'); // y=200
        // Empty URI = CBOR 0x60
        expect(result.hex.substring(16, 18)).toBe('60');
        // BMP follows
        expect(result.hex.substring(18, 22)).toBe('424d'); // 'BM'
      }
    });

    test('should build valid CLAIM with URI when omitted (defaults to empty)', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(0, 0, bmpHex);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should have empty URI (0x60)
        expect(result.hex.substring(16, 18)).toBe('60');
      }
    });

    test('should build valid CLAIM with non-empty URI', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');
      const uri = 'https://example.com/img.png';

      const result = buildClaimOpReturnHex(10, 20, uri, bmpHex);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Check coordinates
        expect(result.hex.substring(8, 12)).toBe('0a00'); // x=10
        expect(result.hex.substring(12, 16)).toBe('1400'); // y=20
        // URI should be CBOR-encoded (starts with 0x78 for length 24-255, or 0x60+len for <24)
        // 'https://example.com/img.png' is 27 chars -> 0x78 0x1b
        expect(result.hex.substring(16, 20)).toBe('781b');
      }
    });
  });

  describe('Invalid coordinates', () => {
    test('should reject negative x coordinate', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(-1, 0, bmpHex);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.x).toBeDefined();
        expect(result.errors.x?.some(e => e.includes('non-negative'))).toBe(true);
      }
    });

    test('should reject negative y coordinate', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(0, -1, bmpHex);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.y).toBeDefined();
        expect(result.errors.y?.some(e => e.includes('non-negative'))).toBe(true);
      }
    });

    test('should reject x > 65535', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(65536, 0, bmpHex);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.x).toBeDefined();
        expect(result.errors.x?.some(e => e.includes('at most 65535'))).toBe(true);
      }
    });

    test('should reject non-integer x coordinate', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(10.5, 0, bmpHex);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.x).toBeDefined();
        expect(result.errors.x?.some(e => e.includes('integer'))).toBe(true);
      }
    });

    test('should reject non-integer y coordinate', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(0, 20.7, bmpHex);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.y).toBeDefined();
        expect(result.errors.y?.some(e => e.includes('integer'))).toBe(true);
      }
    });
  });

  describe('Invalid BMP', () => {
    test('should reject empty BMP hex', () => {
      const result = buildClaimOpReturnHex(0, 0, '');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.bmp).toBeDefined();
        expect(result.errors.bmp?.some(e => e.includes('must not be empty'))).toBe(true);
      }
    });

    test('should reject odd-length BMP hex', () => {
      const result = buildClaimOpReturnHex(0, 0, '123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.bmp).toBeDefined();
        expect(result.errors.bmp?.some(e => e.includes('even length'))).toBe(true);
      }
    });

    test('should reject BMP hex with invalid characters', () => {
      const result = buildClaimOpReturnHex(0, 0, '12zz34');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.bmp).toBeDefined();
        expect(result.errors.bmp?.some(e => e.includes('invalid characters'))).toBe(true);
      }
    });

    test('should reject invalid BMP format (not 24/32-bit uncompressed)', () => {
      // Create an invalid BMP (8-bit indexed)
      const headerSize = 54;
      const buffer = Buffer.alloc(headerSize + 256 * 4 + 10); // Add palette
      buffer.write('BM', 0);
      buffer.writeUInt32LE(buffer.length, 2);
      buffer.writeUInt32LE(0, 6);
      buffer.writeUInt32LE(headerSize + 256 * 4, 10); // Offset includes palette
      buffer.writeUInt32LE(40, 14);
      buffer.writeInt32LE(1, 18); // width
      buffer.writeInt32LE(1, 22); // height
      buffer.writeUInt16LE(1, 26); // planes
      buffer.writeUInt16LE(8, 28); // bits per pixel (8-bit, not 24/32)
      buffer.writeUInt32LE(0, 30); // compression

      const bmpHex = buffer.toString('hex');
      const result = buildClaimOpReturnHex(0, 0, bmpHex);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.bmp).toBeDefined();
        expect(result.errors.bmp?.some(e => e.includes('bits per pixel'))).toBe(true);
      }
    });
  });

  describe('Invalid placement (bounds)', () => {
    test('should reject plot that extends beyond canvas (x + width > 65536)', () => {
      const bmp = createMinimalBMP(2, 1); // 2 pixels wide
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(65535, 0, bmpHex); // 65535 + 2 = 65537 > 65536

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.x).toBeDefined();
        expect(result.errors.y).toBeDefined();
        // Should contain placement error
        expect(result.errors.x?.some(e => e.includes('canvas') || e.includes('bounds'))).toBe(true);
      }
    });

    test('should reject plot that extends beyond canvas (y + height > 65536)', () => {
      const bmp = createMinimalBMP(1, 2); // 2 pixels tall
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(0, 65535, bmpHex); // 65535 + 2 = 65537 > 65536

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.x).toBeDefined();
        expect(result.errors.y).toBeDefined();
        expect(result.errors.y?.some(e => e.includes('canvas') || e.includes('bounds'))).toBe(true);
      }
    });

    test('should accept plot at (65534, 65534) with 2x2 BMP (fits exactly)', () => {
      const bmp = createMinimalBMP(2, 2);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(65534, 65534, bmpHex); // 65534 + 2 = 65536 (max coordinate 65535)

      expect(result.ok).toBe(true);
    });

    test('should accept plot at max valid position (65535, 65535) with 1x1 BMP', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(65535, 65535, bmpHex);

      expect(result.ok).toBe(true);
    });
  });

  describe('URI validation', () => {
    test('should accept empty URI string', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(0, 0, '', bmpHex);

      expect(result.ok).toBe(true);
    });

    test('should accept long URI string', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');
      const uri = 'x'.repeat(1000);

      const result = buildClaimOpReturnHex(0, 0, uri, bmpHex);

      expect(result.ok).toBe(true);
    });
  });

  describe('Output format', () => {
    test('should return lowercase hex with no prefix', () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

      const result = buildClaimOpReturnHex(0, 0, bmpHex);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should be lowercase
        expect(result.hex).toBe(result.hex.toLowerCase());
        // Should not have 0x prefix
        expect(result.hex.startsWith('0x')).toBe(false);
        // Should be valid hex
        expect(/^[0-9a-f]+$/.test(result.hex)).toBe(true);
      }
    });
  });

  describe('End-to-end integration', () => {
    test('should build hex that can be parsed by UBBOpReturnData', () => {
      const bmp = createMinimalBMP(10, 20);
      const bmpHex = bmp.toString('hex');
      const x = 100;
      const y = 200;
      const uri = 'https://example.com/test.png';

      // Build the OP_RETURN hex
      const buildResult = buildClaimOpReturnHex(x, y, uri, bmpHex);

      expect(buildResult.ok).toBe(true);
      if (!buildResult.ok) return;

      // Parse it back with UBBOpReturnData
      const { UBBOpReturnData } = require('../src/transactions');
      const opReturnBuffer = Buffer.from(buildResult.hex, 'hex');
      const parsed = new UBBOpReturnData(opReturnBuffer);

      // Verify parsed data matches input
      expect(parsed.isValid).toBe(true);
      expect(parsed.errors).toHaveLength(0);
      expect(parsed.transactionType).toBe(0x01); // CLAIM
      expect(parsed.transactionTypeString).toBe('CLAIM');
      expect(parsed.x0).toBe(x);
      expect(parsed.y0).toBe(y);
      expect(parsed.uri).toBe(uri);
      expect(parsed.bmpData).toEqual(Buffer.from(bmpHex, 'hex'));
      expect(parsed.isClaim).toBe(true);
    });

    test('should build hex with empty URI that can be parsed by UBBOpReturnData', () => {
      const bmp = createMinimalBMP(5, 5);
      const bmpHex = bmp.toString('hex');
      const x = 1000;
      const y = 2000;

      // Build with empty URI (omitted)
      const buildResult = buildClaimOpReturnHex(x, y, bmpHex);

      expect(buildResult.ok).toBe(true);
      if (!buildResult.ok) return;

      // Parse it back
      const { UBBOpReturnData } = require('../src/transactions');
      const opReturnBuffer = Buffer.from(buildResult.hex, 'hex');
      const parsed = new UBBOpReturnData(opReturnBuffer);

      // Verify
      expect(parsed.isValid).toBe(true);
      expect(parsed.x0).toBe(x);
      expect(parsed.y0).toBe(y);
      expect(parsed.uri).toBe(''); // Empty string
      expect(parsed.bmpData).toEqual(Buffer.from(bmpHex, 'hex'));
    });

    test('should build hex with real BMP file that can be parsed by UBBOpReturnData', () => {
      const bmpPath = path.join(__dirname, 'fixtures', 'uncompressed_24.bmp');
      const bmpBuffer = fs.readFileSync(bmpPath);
      const bmpHex = bmpBuffer.toString('hex');
      const x = 100;
      const y = 200;
      const uri = 'ipfs://QmTest123';

      // Build the OP_RETURN hex
      const buildResult = buildClaimOpReturnHex(x, y, uri, bmpHex);

      expect(buildResult.ok).toBe(true);
      if (!buildResult.ok) {
        console.log('Build errors:', buildResult.errors);
        return;
      }

      // Parse it back
      const { UBBOpReturnData } = require('../src/transactions');
      const opReturnBuffer = Buffer.from(buildResult.hex, 'hex');
      const parsed = new UBBOpReturnData(opReturnBuffer);

      // Debug if parsing fails
      if (!parsed.isValid) {
        console.log('Parse errors:', parsed.errors);
      }

      // Verify everything matches
      expect(parsed.isValid).toBe(true);
      expect(parsed.errors).toHaveLength(0);
      expect(parsed.transactionType).toBe(0x01);
      expect(parsed.x0).toBe(x);
      expect(parsed.y0).toBe(y);
      expect(parsed.uri).toBe(uri);
      expect(parsed.bmpData).toEqual(bmpBuffer);
      expect(parsed.magicBytes).toEqual(Buffer.from([0x13, 0x37]));
      expect(parsed.version).toBe(0x01);
    });
  });
});
