import { UBBOpReturnData } from '../src/transactions';
import { encode as cborEncode } from 'cbor-x';

describe('UBBOpReturnData', () => {
  describe('Valid OP_RETURN data parsing', () => {
    test('should parse CLAIM transaction OP_RETURN data', () => {
      // Create CLAIM transaction OP_RETURN data
      const uri = 'https://example.com/a';
      const cbor = cborEncode(uri);
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // Transaction type (CLAIM)
        Buffer.from([0x64, 0x00]), // X coordinate (100) - little endian
        Buffer.from([0xC8, 0x00]), // Y coordinate (200) - little endian
        cbor,
        Buffer.from('bmp data') // BMP data
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(true);
      expect(parsed.errors).toHaveLength(0);
      expect(parsed.magicBytes).toEqual(Buffer.from([0x13, 0x37]));
      expect(parsed.version).toBe(0x01);
      expect(parsed.transactionType).toBe(0x01);
      expect(parsed.transactionTypeString).toBe('CLAIM');
      expect(parsed.x0).toBe(100);
      expect(parsed.y0).toBe(200);
      expect(parsed.bmpData).toEqual(Buffer.from('bmp data'));
      expect(parsed.uri).toBe(uri);
      expect(parsed.isClaim).toBe(true);
      expect(parsed.isRetryClaim).toBe(false);
      expect(parsed.isUpdate).toBe(false);
      expect(parsed.isTransfer).toBe(false);
      expect(parsed.requiresBmpData).toBe(true);
      expect(parsed.requiresCoordinates).toBe(true);
    });

    test('should parse RETRY-CLAIM transaction OP_RETURN data', () => {
      const uri = '';
      const cbor = Buffer.from([0x60]);
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x02]), // Transaction type (RETRY-CLAIM)
        Buffer.from([0x64, 0x00]), // X coordinate (100)
        Buffer.from([0xC8, 0x00]), // Y coordinate (200)
        // No BMP data for RETRY-CLAIM
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(true);
      expect(parsed.transactionTypeString).toBe('RETRY-CLAIM');
      expect(parsed.x0).toBe(100);
      expect(parsed.y0).toBe(200);
      expect(parsed.bmpData).toBe(null);
      expect(parsed.isRetryClaim).toBe(true);
      expect(parsed.requiresBmpData).toBe(false);
      expect(parsed.requiresCoordinates).toBe(true);
    });

    test('should parse UPDATE transaction OP_RETURN data', () => {
      const uri = 'u';
      const cbor = cborEncode(uri);
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x03]), // Transaction type (UPDATE)
        Buffer.from([0x64, 0x00]), // X coordinate (100)
        Buffer.from([0xC8, 0x00]), // Y coordinate (200)
        cbor,
        Buffer.from('updated bmp data') // BMP data
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(true);
      expect(parsed.transactionTypeString).toBe('UPDATE');
      expect(parsed.x0).toBe(100);
      expect(parsed.y0).toBe(200);
      expect(parsed.bmpData).toEqual(Buffer.from('updated bmp data'));
      expect(parsed.isUpdate).toBe(true);
      expect(parsed.requiresBmpData).toBe(true);
      expect(parsed.requiresCoordinates).toBe(true);
    });

    test('should parse TRANSFER transaction OP_RETURN data', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x04]), // Transaction type (TRANSFER)
        Buffer.from([0x00, 0x00]), // X coordinate (0)
        Buffer.from([0x00, 0x00]), // Y coordinate (0)
        // No BMP data for TRANSFER
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(true);
      expect(parsed.transactionTypeString).toBe('TRANSFER');
      expect(parsed.x0).toBe(0);
      expect(parsed.y0).toBe(0);
      expect(parsed.bmpData).toBe(null);
      expect(parsed.isTransfer).toBe(true);
      expect(parsed.requiresBmpData).toBe(false);
      expect(parsed.requiresCoordinates).toBe(false);
    });
  });

  describe('Invalid OP_RETURN data parsing', () => {
    test('should handle data that is too short', () => {
      const opReturnData = Buffer.from([0x13, 0x37, 0x01]); // Only 3 bytes
      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('OP_RETURN data too short (minimum 8 bytes required)');
    });

    test('should handle invalid magic bytes', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x12, 0x34]), // Wrong magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // Transaction type
        Buffer.from([0x64, 0x00]), // X coordinate
        Buffer.from([0xC8, 0x00]), // Y coordinate
        Buffer.from([0x60]), // empty URI
        Buffer.from('bmp data')
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('Invalid magic bytes: expected 0x13 0x37, got 0x1234');
    });

    test('should handle unsupported version', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x02]), // Unsupported version
        Buffer.from([0x01]), // Transaction type
        Buffer.from([0x64, 0x00]), // X coordinate
        Buffer.from([0xC8, 0x00]), // Y coordinate
        Buffer.from([0x60]), // empty URI
        Buffer.from('bmp data')
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('Unsupported version: expected 0x01, got 0x02');
    });

    test('should handle invalid transaction type', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x05]), // Invalid transaction type
        Buffer.from([0x64, 0x00]), // X coordinate
        Buffer.from([0xC8, 0x00]), // Y coordinate
        Buffer.from([0x60]), // empty URI
        Buffer.from('bmp data')
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('Invalid transaction type: 5');
    });

    test('should handle missing BMP data for CLAIM transaction', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // Transaction type (CLAIM)
        Buffer.from([0x64, 0x00]), // X coordinate
        Buffer.from([0xC8, 0x00]), // Y coordinate
        // No BMP data - should be error
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CLAIM transaction requires BMP data');
    });

    test('should handle missing BMP data for UPDATE transaction', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x03]), // Transaction type (UPDATE)
        Buffer.from([0x64, 0x00]), // X coordinate
        Buffer.from([0xC8, 0x00]), // Y coordinate
        // No BMP data - should be error
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('UPDATE transaction requires BMP data');
    });

    test('should be invalid when CLAIM has URI but no BMP data', () => {
      const uri = 'https://example.com/img';
      const cbor = cborEncode(uri);
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // CLAIM
        Buffer.from([0x10, 0x00]), // X
        Buffer.from([0x20, 0x00]), // Y
        cbor // URI present, but no BMP data follows
      ]);

      const parsed = new UBBOpReturnData(opReturnData);
      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CLAIM transaction requires BMP data');
    });

    test('should be invalid when UPDATE has URI but no BMP data', () => {
      const uri = 'u';
      const cbor = cborEncode(uri);
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x03]), // UPDATE
        Buffer.from([0x10, 0x00]), // X
        Buffer.from([0x20, 0x00]), // Y
        cbor // URI present, but no BMP data follows
      ]);

      const parsed = new UBBOpReturnData(opReturnData);
      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('UPDATE transaction requires BMP data');
    });

    test('should be invalid when CLAIM has no URI (immediately BMP)', () => {
      // Start BMP with a non-text initial byte to avoid accidental valid CBOR text
      const bmp = Buffer.from([0x41, 0x00, 0x00, 0x00]); // CBOR major type 2 (bytes), length=1 -> not text
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // CLAIM
        Buffer.from([0x64, 0x00]), // X
        Buffer.from([0xC8, 0x00]), // Y
        bmp // No CBOR text, straight to BMP
      ]);

      const parsed = new UBBOpReturnData(opReturnData);
      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });

    test('should be invalid when UPDATE has no URI (immediately BMP)', () => {
      // Start BMP with a non-text initial byte to avoid accidental valid CBOR text
      const bmp = Buffer.from([0x41, 0x00, 0x00, 0x00]); // CBOR major type 2 (bytes), length=1 -> not text
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x03]), // UPDATE
        Buffer.from([0x64, 0x00]), // X
        Buffer.from([0xC8, 0x00]), // Y
        bmp // No CBOR text, straight to BMP
      ]);

      const parsed = new UBBOpReturnData(opReturnData);
      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });

    test('should be invalid when CLAIM has no URI and no more data', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // CLAIM
        Buffer.from([0x00, 0x00]), // X
        Buffer.from([0x00, 0x00]), // Y
        // No URI, no BMP
      ]);

      const parsed = new UBBOpReturnData(opReturnData);
      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('Failed to decode CBOR text string for URI: empty buffer');
      expect(parsed.errors).toContain('CLAIM transaction requires BMP data');
    });
  });

  describe('Edge cases', () => {
    test('should handle large coordinates', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // Transaction type (CLAIM)
        Buffer.from([0xFF, 0xFF]), // X coordinate (65535)
        Buffer.from([0xFF, 0xFF]), // Y coordinate (65535)
        Buffer.from([0x60]), // empty URI
        Buffer.from('bmp data')
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(true);
      expect(parsed.x0).toBe(65535);
      expect(parsed.y0).toBe(65535);
    });

    test('should handle zero coordinates', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // Transaction type (CLAIM)
        Buffer.from([0x00, 0x00]), // X coordinate (0)
        Buffer.from([0x00, 0x00]), // Y coordinate (0)
        Buffer.from([0x60]), // empty URI
        Buffer.from('bmp data')
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(true);
      expect(parsed.x0).toBe(0);
      expect(parsed.y0).toBe(0);
    });

    test('should handle empty BMP data', () => {
      // Create a buffer that's longer than 8 bytes to indicate BMP data was provided (even if empty)
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // Transaction type (CLAIM)
        Buffer.from([0x64, 0x00]), // X coordinate
        Buffer.from([0xC8, 0x00]), // Y coordinate
        Buffer.from([0x60]), // empty URI
        Buffer.alloc(1) // 1 byte of BMP data (empty but present)
      ]);

      const parsed = new UBBOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(true);
      expect(parsed.bmpData).toEqual(Buffer.alloc(1));
    });
  });

  describe('Factory methods', () => {
    test('should create from raw OP_RETURN data', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]),
        Buffer.from([0x01]),
        Buffer.from([0x01]),
        Buffer.from([0x64, 0x00]),
        Buffer.from([0xC8, 0x00]),
        Buffer.from([0x60]),
        Buffer.from('bmp data')
      ]);

      const parsed = UBBOpReturnData.fromOpReturnData(opReturnData);

      expect(parsed.isValid).toBe(true);
      expect(parsed.transactionTypeString).toBe('CLAIM');
    });

    test('should create from Bitcoin transaction', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]),
        Buffer.from([0x01]),
        Buffer.from([0x01]),
        Buffer.from([0x64, 0    ]),
        Buffer.from([0xC8, 0x00]),
        Buffer.from([0x60]),
        Buffer.from('bmp data')
      ]);

      const mockBitcoinTx = {
        opReturnData: opReturnData
      };

      const parsed = UBBOpReturnData.fromBitcoinTransaction(mockBitcoinTx);

      expect(parsed).not.toBeNull();
      expect(parsed!.isValid).toBe(true);
      expect(parsed!.transactionTypeString).toBe('CLAIM');
    });

    test('should return null for Bitcoin transaction without OP_RETURN', () => {
      const mockBitcoinTx = {
        opReturnData: null
      };

      const parsed = UBBOpReturnData.fromBitcoinTransaction(mockBitcoinTx);

      expect(parsed).toBeNull();
    });
  });

  describe('Transaction type properties', () => {
    test('should correctly identify transaction types', () => {
      const claimData = Buffer.concat([
        Buffer.from([0x13, 0x37]), Buffer.from([0x01]), Buffer.from([0x01]), Buffer.from([0x00]),
        Buffer.from([0x00, 0x00]), Buffer.from([0x00, 0x00]), Buffer.from('data')
      ]);
      const retryClaimData = Buffer.concat([
        Buffer.from([0x13, 0x37]), Buffer.from([0x01]), Buffer.from([0x02]), Buffer.from([0x00]),
        Buffer.from([0x00, 0x00]), Buffer.from([0x00, 0x00])
      ]);
      const updateData = Buffer.concat([
        Buffer.from([0x13, 0x37]), Buffer.from([0x01]), Buffer.from([0x03]), Buffer.from([0x00]),
        Buffer.from([0x00, 0x00]), Buffer.from([0x00, 0x00]), Buffer.from('data')
      ]);
      const transferData = Buffer.concat([
        Buffer.from([0x13, 0x37]), Buffer.from([0x01]), Buffer.from([0x04]), Buffer.from([0x00]),
        Buffer.from([0x00, 0x00]), Buffer.from([0x00, 0x00])
      ]);

      const claim = new UBBOpReturnData(claimData);
      const retryClaim = new UBBOpReturnData(retryClaimData);
      const update = new UBBOpReturnData(updateData);
      const transfer = new UBBOpReturnData(transferData);

      expect(claim.isClaim).toBe(true);
      expect(claim.isRetryClaim).toBe(false);
      expect(claim.isUpdate).toBe(false);
      expect(claim.isTransfer).toBe(false);

      expect(retryClaim.isClaim).toBe(false);
      expect(retryClaim.isRetryClaim).toBe(true);
      expect(retryClaim.isUpdate).toBe(false);
      expect(retryClaim.isTransfer).toBe(false);

      expect(update.isClaim).toBe(false);
      expect(update.isRetryClaim).toBe(false);
      expect(update.isUpdate).toBe(true);
      expect(update.isTransfer).toBe(false);

      expect(transfer.isClaim).toBe(false);
      expect(transfer.isRetryClaim).toBe(false);
      expect(transfer.isUpdate).toBe(false);
      expect(transfer.isTransfer).toBe(true);
    });
  
  describe('URI field', () => {
    test('should parse URI CBOR text for CLAIM', () => {
      const uri = 'https://example.com/a';
      const uriBytes = Buffer.from(uri, 'utf8');
      const cbor = uriBytes.length < 24
        ? Buffer.concat([Buffer.from([0x60 + uriBytes.length]), uriBytes])
        : Buffer.concat([Buffer.from([0x78, uriBytes.length]), uriBytes]);
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]),
        Buffer.from([0x01]),
        Buffer.from([0x01]), // CLAIM
        Buffer.from([0x64, 0x00]),
        Buffer.from([0xC8, 0x00]),
        cbor,
        Buffer.from('bmp data')
      ]);

      const parsed = new UBBOpReturnData(opReturnData);
      expect(parsed.isValid).toBe(true);
      expect(parsed.uri).toBe(uri);
      expect(parsed.bmpData).toEqual(Buffer.from('bmp data'));
    });

    test('should error when CBOR major type is not text', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]),
        Buffer.from([0x01]),
        Buffer.from([0x03]), // UPDATE
        Buffer.from([0x00, 0x00]),
        Buffer.from([0x00, 0x00]),
        Buffer.from([0x41, 0x61]), // CBOR major type 2 (bytes) length 1 with 'a'
      ]);

      const parsed = new UBBOpReturnData(opReturnData);
      expect(parsed.isValid).toBe(false);
      expect(parsed.errors).toContain('CBOR text: expected major type 3 (text string)');
    });
  });
  });
});
