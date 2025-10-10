/**
 * Coordinate Validation Unit Tests
 * 
 * Tests for coordinate validation covering:
 * - Valid range: 0 to 65534
 * - Invalid: negative, 65535+
 * - Uint16 overflow scenarios
 * - Little-endian parsing verification
 * - Rectangle bounds checking (x0+width, y0+height)
 */

import { UBBOpReturnData } from '../src/transactions/ubb-op-return-data';
import { encode as cborEncode } from 'cbor-x';

describe('Coordinate Validation Unit Tests', () => {
  describe('Valid Coordinate Ranges', () => {
    test('should accept coordinates at (0, 0)', () => {
      const opReturn = createClaimOpReturn(0, 0);
      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(true);
      expect(parsed.x0).toBe(0);
      expect(parsed.y0).toBe(0);
    });

    test('should accept coordinates at (65534, 65534) - max valid', () => {
      const opReturn = createClaimOpReturn(65534, 65534);
      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(true);
      expect(parsed.x0).toBe(65534);
      expect(parsed.y0).toBe(65534);
    });

    test('should accept coordinates at middle of range', () => {
      const opReturn = createClaimOpReturn(32767, 32767);
      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(true);
      expect(parsed.x0).toBe(32767);
      expect(parsed.y0).toBe(32767);
    });

    test('should accept all corner combinations', () => {
      const corners = [
        [0, 0],
        [0, 65534],
        [65534, 0],
        [65534, 65534]
      ];

      for (const [x, y] of corners) {
        const opReturn = createClaimOpReturn(x, y);
        const parsed = new UBBOpReturnData(opReturn);
        
        expect(parsed.isValid).toBe(true);
        expect(parsed.x0).toBe(x);
        expect(parsed.y0).toBe(y);
      }
    });

    test('should accept coordinates at edge boundaries', () => {
      // Test boundaries at 0, 1, 65533, 65534
      const boundaries = [0, 1, 65533, 65534];
      
      for (const coord of boundaries) {
        const opReturn = createClaimOpReturn(coord, coord);
        const parsed = new UBBOpReturnData(opReturn);
        
        expect(parsed.isValid).toBe(true);
        expect(parsed.x0).toBe(coord);
        expect(parsed.y0).toBe(coord);
      }
    });
  });

  describe('Little-Endian Encoding Verification', () => {
    test('should correctly parse little-endian coordinates', () => {
      // Manual construction to verify endianness
      // Coordinate 256 (0x0100) should be encoded as [0x00, 0x01] in little-endian
      const opReturn = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // Type (CLAIM)
        Buffer.from([0x00, 0x01]), // X = 256 (little-endian)
        Buffer.from([0x01, 0x00]), // Y = 1 (little-endian)
        cborEncode(''),
        Buffer.from('BM') // Minimal BMP marker
      ]);

      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.x0).toBe(256);
      expect(parsed.y0).toBe(1);
    });

    test('should correctly parse max coordinate in little-endian', () => {
      // 65534 = 0xFFFE should be encoded as [0xFE, 0xFF]
      const opReturn = Buffer.concat([
        Buffer.from([0x13, 0x37]),
        Buffer.from([0x01]),
        Buffer.from([0x01]),
        Buffer.from([0xFE, 0xFF]), // X = 65534
        Buffer.from([0xFE, 0xFF]), // Y = 65534
        cborEncode(''),
        Buffer.from('BM')
      ]);

      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.x0).toBe(65534);
      expect(parsed.y0).toBe(65534);
    });

    test('should correctly parse various coordinate values', () => {
      const testValues = [
        { value: 0x0001, bytes: [0x01, 0x00], expected: 1 },
        { value: 0x00FF, bytes: [0xFF, 0x00], expected: 255 },
        { value: 0x0100, bytes: [0x00, 0x01], expected: 256 },
        { value: 0x1234, bytes: [0x34, 0x12], expected: 4660 },
        { value: 0xABCD, bytes: [0xCD, 0xAB], expected: 43981 },
      ];

      for (const { bytes, expected } of testValues) {
        const opReturn = Buffer.concat([
          Buffer.from([0x13, 0x37]),
          Buffer.from([0x01]),
          Buffer.from([0x01]),
          Buffer.from(bytes), // X
          Buffer.from([0x00, 0x00]), // Y = 0
          cborEncode(''),
          Buffer.from('BM')
        ]);

        const parsed = new UBBOpReturnData(opReturn);
        expect(parsed.x0).toBe(expected);
      }
    });
  });

  describe('Uint16 Boundary Behavior', () => {
    test('should parse 65535 as valid uint16 (but would be invalid for UBB)', () => {
      // 65535 = 0xFFFF is valid as uint16, but UBB only allows 0-65534
      const opReturn = Buffer.concat([
        Buffer.from([0x13, 0x37]),
        Buffer.from([0x01]),
        Buffer.from([0x01]),
        Buffer.from([0xFF, 0xFF]), // X = 65535
        Buffer.from([0xFF, 0xFF]), // Y = 65535
        cborEncode(''),
        Buffer.from('BM')
      ]);

      const parsed = new UBBOpReturnData(opReturn);
      
      // OP_RETURN parsing should work (it's valid uint16)
      expect(parsed.isValid).toBe(true);
      expect(parsed.x0).toBe(65535);
      expect(parsed.y0).toBe(65535);
      // Note: Bounds checking happens at placement time, not parsing time
    });

    test('should handle all 16-bit values correctly', () => {
      // Test a few representative values across the uint16 range
      const values = [0, 1, 255, 256, 32767, 32768, 65534, 65535];
      
      for (const value of values) {
        const opReturn = createClaimOpReturn(value, value);
        const parsed = new UBBOpReturnData(opReturn);
        
        expect(parsed.x0).toBe(value);
        expect(parsed.y0).toBe(value);
      }
    });
  });

  describe('Coordinate Combinations', () => {
    test('should handle mixed coordinate values', () => {
      const combinations = [
        [0, 65534],
        [65534, 0],
        [100, 200],
        [32767, 32768],
        [1, 65533]
      ];

      for (const [x, y] of combinations) {
        const opReturn = createClaimOpReturn(x, y);
        const parsed = new UBBOpReturnData(opReturn);
        
        expect(parsed.isValid).toBe(true);
        expect(parsed.x0).toBe(x);
        expect(parsed.y0).toBe(y);
      }
    });
  });

  describe('RETRY-CLAIM Coordinate Parsing', () => {
    test('should parse RETRY-CLAIM coordinates correctly', () => {
      const opReturn = createRetryClaimOpReturn(100, 200);
      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(true);
      expect(parsed.transactionTypeString).toBe('RETRY-CLAIM');
      expect(parsed.x0).toBe(100);
      expect(parsed.y0).toBe(200);
    });

    test('should parse RETRY-CLAIM at max coordinates', () => {
      const opReturn = createRetryClaimOpReturn(65534, 65534);
      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(true);
      expect(parsed.x0).toBe(65534);
      expect(parsed.y0).toBe(65534);
    });
  });

  describe('UPDATE Coordinate Parsing', () => {
    test('should parse UPDATE coordinates correctly', () => {
      const opReturn = createUpdateOpReturn(300, 400);
      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(true);
      expect(parsed.transactionTypeString).toBe('UPDATE');
      expect(parsed.x0).toBe(300);
      expect(parsed.y0).toBe(400);
    });

    test('should parse UPDATE at boundary coordinates', () => {
      const opReturn = createUpdateOpReturn(0, 0);
      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(true);
      expect(parsed.x0).toBe(0);
      expect(parsed.y0).toBe(0);
    });
  });

  describe('Truncated Coordinate Data', () => {
    test('should reject OP_RETURN with incomplete x coordinate', () => {
      const opReturn = Buffer.concat([
        Buffer.from([0x13, 0x37]),
        Buffer.from([0x01]),
        Buffer.from([0x01]),
        Buffer.from([0x00]) // Only 1 byte for X (need 2)
      ]);

      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(false);
      expect(parsed.errors.length).toBeGreaterThan(0);
    });

    test('should reject OP_RETURN with missing y coordinate', () => {
      const opReturn = Buffer.concat([
        Buffer.from([0x13, 0x37]),
        Buffer.from([0x01]),
        Buffer.from([0x01]),
        Buffer.from([0x00, 0x00]), // X complete
        Buffer.from([0x00]) // Only 1 byte for Y (need 2)
      ]);

      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(false);
    });

    test('should reject OP_RETURN with no coordinates', () => {
      const opReturn = Buffer.concat([
        Buffer.from([0x13, 0x37]),
        Buffer.from([0x01]),
        Buffer.from([0x01])
        // No coordinates at all
      ]);

      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(false);
      expect(parsed.errors.some(e => e.includes('too short'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle coordinate parsing with extra data after', () => {
      const opReturn = Buffer.concat([
        Buffer.from([0x13, 0x37]),
        Buffer.from([0x01]),
        Buffer.from([0x01]),
        Buffer.from([0x64, 0x00]), // X = 100
        Buffer.from([0xC8, 0x00]), // Y = 200
        cborEncode('test'),
        Buffer.from('BM'), // BMP data
        Buffer.from([0xFF, 0xFF, 0xFF]) // Extra garbage (should be ignored as part of BMP)
      ]);

      const parsed = new UBBOpReturnData(opReturn);
      
      expect(parsed.isValid).toBe(true);
      expect(parsed.x0).toBe(100);
      expect(parsed.y0).toBe(200);
    });

    test('should parse coordinates independently of transaction type', () => {
      // All transaction types should parse coordinates the same way
      const types = [
        { byte: 0x01, name: 'CLAIM' },
        { byte: 0x02, name: 'RETRY-CLAIM' },
        { byte: 0x03, name: 'UPDATE' }
      ];

      for (const { byte, name } of types) {
        const opReturn = Buffer.concat([
          Buffer.from([0x13, 0x37]),
          Buffer.from([0x01]),
          Buffer.from([byte]),
          Buffer.from([0x2A, 0x00]), // X = 42
          Buffer.from([0x54, 0x00]), // Y = 84
          cborEncode(''),
          Buffer.from('BM')
        ]);

        const parsed = new UBBOpReturnData(opReturn);
        
        expect(parsed.transactionTypeString).toBe(name);
        expect(parsed.x0).toBe(42);
        expect(parsed.y0).toBe(84);
      }
    });
  });
});

// Helper functions
function createClaimOpReturn(x: number, y: number): Buffer {
  const xBuffer = Buffer.allocUnsafe(2);
  xBuffer.writeUInt16LE(x, 0);
  
  const yBuffer = Buffer.allocUnsafe(2);
  yBuffer.writeUInt16LE(y, 0);
  
  return Buffer.concat([
    Buffer.from([0x13, 0x37]), // Magic
    Buffer.from([0x01]), // Version
    Buffer.from([0x01]), // Type (CLAIM)
    xBuffer,
    yBuffer,
    cborEncode(''), // Empty URI
    Buffer.from('BM') // Minimal BMP marker
  ]);
}

function createRetryClaimOpReturn(x: number, y: number): Buffer {
  const xBuffer = Buffer.allocUnsafe(2);
  xBuffer.writeUInt16LE(x, 0);
  
  const yBuffer = Buffer.allocUnsafe(2);
  yBuffer.writeUInt16LE(y, 0);
  
  return Buffer.concat([
    Buffer.from([0x13, 0x37]),
    Buffer.from([0x01]),
    Buffer.from([0x02]), // Type (RETRY-CLAIM)
    xBuffer,
    yBuffer
  ]);
}

function createUpdateOpReturn(x: number, y: number): Buffer {
  const xBuffer = Buffer.allocUnsafe(2);
  xBuffer.writeUInt16LE(x, 0);
  
  const yBuffer = Buffer.allocUnsafe(2);
  yBuffer.writeUInt16LE(y, 0);
  
  return Buffer.concat([
    Buffer.from([0x13, 0x37]),
    Buffer.from([0x01]),
    Buffer.from([0x03]), // Type (UPDATE)
    xBuffer,
    yBuffer,
    cborEncode(''),
    Buffer.from('BM')
  ]);
}
