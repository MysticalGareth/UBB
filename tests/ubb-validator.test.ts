import * as fs from 'fs';
import * as path from 'path';
import { 
  UBBBMP, 
  UBBPlot, 
  UBBValidator, 
  createUBBBMPFromFile,
  UBBClaimTransaction,
  UBBRetryClaimTransaction,
  UBBUpdateTransaction,
  UBBTransferTransaction,
  UBBTransaction,
  BitcoinTransaction,
  BitcoinInput,
  BitcoinOutput
} from '../src/ubb-validator';

describe('UBB Validator Test Suite', () => {
  const compressedBmpPath = path.join(__dirname, 'fixtures', 'compressed_32bit.bmp');
  const uncompressedBmpPath = path.join(__dirname, 'fixtures', 'uncompressed_24.bmp');

  describe('UBBBMP Class', () => {
    describe('Compressed 32-bit BMP (should be invalid)', () => {
      let ubbBmp: UBBBMP;

      beforeAll(() => {
        const buffer = fs.readFileSync(compressedBmpPath);
        ubbBmp = new UBBBMP(buffer);
      });

      test('should be invalid due to compression', () => {
        expect(ubbBmp.isValid).toBe(false);
      });

      test('should have correct dimensions', () => {
        expect(ubbBmp.width).toBe(100);
        expect(ubbBmp.height).toBe(100);
      });

      test('should be 32-bit format', () => {
        expect(ubbBmp.bitsPerPixel).toBe(32);
        expect(ubbBmp.is32Bit).toBe(true);
        expect(ubbBmp.is24Bit).toBe(false);
      });

      test('should have compression errors', () => {
        expect(ubbBmp.validationErrors).toContain(
          'Invalid compression: 3. Must be BI_RGB (0) - uncompressed only.'
        );
      });

      test('should have correct file size validation', () => {
        expect(ubbBmp.hasCorrectFileSize).toBe(true);
        expect(ubbBmp.fileSize).toBe(40138);
        expect(ubbBmp.expectedFileSize).toBe(40138);
      });

      test('should calculate area correctly', () => {
        expect(ubbBmp.area).toBe(10000); // 100 * 100
      });

      test('should have correct absolute height', () => {
        expect(ubbBmp.absoluteHeight).toBe(100);
      });

      test('should have correct stride calculation', () => {
        expect(ubbBmp.stride).toBe(400); // 100 * 4 bytes per pixel
      });
    });

    describe('Uncompressed 24-bit BMP (should be valid)', () => {
      let ubbBmp: UBBBMP;

      beforeAll(() => {
        const buffer = fs.readFileSync(uncompressedBmpPath);
        ubbBmp = new UBBBMP(buffer);
      });

      test('should be valid', () => {
        expect(ubbBmp.isValid).toBe(true);
      });

      test('should have correct dimensions', () => {
        expect(ubbBmp.width).toBeGreaterThan(0);
        expect(ubbBmp.height).toBeGreaterThan(0);
      });

      test('should be 24-bit format', () => {
        expect(ubbBmp.bitsPerPixel).toBe(24);
        expect(ubbBmp.is24Bit).toBe(true);
        expect(ubbBmp.is32Bit).toBe(false);
      });

      test('should be uncompressed', () => {
        expect(ubbBmp.isUncompressed).toBe(true);
        expect(ubbBmp.compression).toBe(0);
      });

      test('should have no validation errors', () => {
        expect(ubbBmp.validationErrors).toHaveLength(0);
      });

      test('should have correct file size', () => {
        expect(ubbBmp.hasCorrectFileSize).toBe(true);
      });

      test('should calculate area correctly', () => {
        expect(ubbBmp.area).toBe(ubbBmp.width * ubbBmp.height);
      });
    });

    describe('createUBBBMPFromFile helper', () => {
      test('should create UBBBMP from file path', () => {
        const ubbBmp = createUBBBMPFromFile(compressedBmpPath);
        expect(ubbBmp).toBeInstanceOf(UBBBMP);
        expect(ubbBmp.width).toBe(100);
        expect(ubbBmp.height).toBe(100);
      });
    });

    describe('BMP Orientation (top-down vs bottom-up)', () => {
      test('should handle bottom-up BMP (positive height)', () => {
        const bmp = createBottomUpBMP(10, 10);
        const ubbBmp = new UBBBMP(bmp);
        
        expect(ubbBmp.isValid).toBe(true);
        expect(ubbBmp.width).toBe(10);
        expect(ubbBmp.height).toBe(10);
        expect(ubbBmp.absoluteHeight).toBe(10);
      });

      test('should handle top-down BMP (negative height)', () => {
        const bmp = createTopDownBMP(10, 10);
        const ubbBmp = new UBBBMP(bmp);
        
        expect(ubbBmp.isValid).toBe(true);
        expect(ubbBmp.width).toBe(10);
        // bmp-js library normalizes negative height to positive
        expect(Math.abs(ubbBmp.height)).toBe(10);
        expect(ubbBmp.absoluteHeight).toBe(10); // Absolute value
      });

      test('should calculate correct file size for top-down BMP', () => {
        const bmp = createTopDownBMP(10, 10);
        const ubbBmp = new UBBBMP(bmp);
        
        expect(ubbBmp.hasCorrectFileSize).toBe(true);
      });
    });

    describe('Stride Calculation Edge Cases', () => {
      test('should calculate stride correctly for width requiring padding (24-bit)', () => {
        // Width 1: 3 bytes/row → padded to 4 bytes
        const bmp1 = create24BitBMP(1, 1);
        const ubbBmp1 = new UBBBMP(bmp1);
        expect(ubbBmp1.stride).toBe(4);

        // Width 2: 6 bytes/row → padded to 8 bytes
        const bmp2 = create24BitBMP(2, 1);
        const ubbBmp2 = new UBBBMP(bmp2);
        expect(ubbBmp2.stride).toBe(8);

        // Width 3: 9 bytes/row → padded to 12 bytes
        const bmp3 = create24BitBMP(3, 1);
        const ubbBmp3 = new UBBBMP(bmp3);
        expect(ubbBmp3.stride).toBe(12);
      });

      test('should calculate stride correctly for aligned width (24-bit)', () => {
        // Width 4: 12 bytes/row → already aligned
        const bmp = create24BitBMP(4, 1);
        const ubbBmp = new UBBBMP(bmp);
        expect(ubbBmp.stride).toBe(12);
      });

      test('should calculate stride correctly for 32-bit (always aligned)', () => {
        // 32-bit is always 4-byte aligned
        const widths = [1, 2, 3, 4, 5];
        for (const width of widths) {
          const bmp = create32BitBMP(width, 1);
          const ubbBmp = new UBBBMP(bmp);
          expect(ubbBmp.stride).toBe(width * 4);
        }
      });
    });

    describe('File Size Validation Edge Cases', () => {
      test('should reject BMP with file size off by 1 byte (too small)', () => {
        const bmp = create24BitBMP(2, 2);
        const truncated = bmp.subarray(0, bmp.length - 1);
        const ubbBmp = new UBBBMP(truncated);
        
        expect(ubbBmp.isValid).toBe(false);
        expect(ubbBmp.validationErrors.some(e => e.includes('Buffer size mismatch'))).toBe(true);
      });

      test('should reject BMP with file size off by 1 byte (too large)', () => {
        const bmp = create24BitBMP(2, 2);
        const padded = Buffer.concat([bmp, Buffer.from([0])]);
        // Need to update header file size
        padded.writeUInt32LE(padded.length, 2);
        const ubbBmp = new UBBBMP(padded);
        
        expect(ubbBmp.isValid).toBe(false);
        expect(ubbBmp.validationErrors.some(e => e.includes('File size mismatch'))).toBe(true);
      });

      test('should reject BMP with corrupted file size in header', () => {
        const bmp = create24BitBMP(2, 2);
        // Write wrong file size in header
        bmp.writeUInt32LE(bmp.length + 100, 2);
        const ubbBmp = new UBBBMP(bmp);
        
        expect(ubbBmp.isValid).toBe(false);
        expect(ubbBmp.validationErrors.some(e => e.includes('Buffer size mismatch'))).toBe(true);
      });
    });

    describe('Dimension Boundary Cases', () => {
      test('should accept 1x1 BMP', () => {
        const bmp = create24BitBMP(1, 1);
        const ubbBmp = new UBBBMP(bmp);
        
        expect(ubbBmp.isValid).toBe(true);
        expect(ubbBmp.width).toBe(1);
        expect(ubbBmp.height).toBe(1);
      });

      test('should accept very large dimensions', () => {
        const bmp = create24BitBMP(65535, 1);
        const ubbBmp = new UBBBMP(bmp);
        
        expect(ubbBmp.isValid).toBe(true);
        expect(ubbBmp.width).toBe(65535);
      });

      test('should reject zero width', () => {
        const bmp = create24BitBMP(0, 10);
        const ubbBmp = new UBBBMP(bmp);
        
        expect(ubbBmp.isValid).toBe(false);
        expect(ubbBmp.validationErrors.some(e => e.includes('Zero-sized'))).toBe(true);
      });

      test('should reject zero height', () => {
        const bmp = create24BitBMP(10, 0);
        const ubbBmp = new UBBBMP(bmp);
        
        expect(ubbBmp.isValid).toBe(false);
        expect(ubbBmp.validationErrors.some(e => e.includes('Zero-sized'))).toBe(true);
      });
    });

    describe('32-bit Alpha Channel Variations', () => {
      test('should accept 32-bit BMP (has alpha)', () => {
        const bmp = create32BitBMP(10, 10);
        const ubbBmp = new UBBBMP(bmp);
        
        expect(ubbBmp.isValid).toBe(true);
        expect(ubbBmp.is32Bit).toBe(true);
        expect(ubbBmp.bitsPerPixel).toBe(32);
      });

      test('should calculate correct stride for 32-bit', () => {
        const bmp = create32BitBMP(10, 10);
        const ubbBmp = new UBBBMP(bmp);
        
        // 10 pixels * 4 bytes = 40 bytes (already 4-byte aligned)
        expect(ubbBmp.stride).toBe(40);
      });

      test('should validate file size for 32-bit correctly', () => {
        const bmp = create32BitBMP(10, 10);
        const ubbBmp = new UBBBMP(bmp);
        
        expect(ubbBmp.hasCorrectFileSize).toBe(true);
        expect(ubbBmp.fileSize).toBe(ubbBmp.expectedFileSize);
      });
    });
  });

  describe('UBBPlot Class', () => {
    let validBmp: UBBBMP;
    let invalidBmp: UBBBMP;

    beforeAll(() => {
      const validBuffer = fs.readFileSync(uncompressedBmpPath);
      const invalidBuffer = fs.readFileSync(compressedBmpPath);
      validBmp = new UBBBMP(validBuffer);
      invalidBmp = new UBBBMP(invalidBuffer);
    });

    describe('Valid BMP with valid placement', () => {
      test('should create valid plot at origin', () => {
        const plot = new UBBPlot(validBmp, 0, 0);
        expect(plot.isValid).toBe(true);
        expect(plot.withinCanvas).toBe(true);
        expect(plot.validationErrors).toHaveLength(0);
      });

      test('should create valid plot at offset position', () => {
        const plot = new UBBPlot(validBmp, 1000, 1000);
        expect(plot.isValid).toBe(true);
        expect(plot.withinCanvas).toBe(true);
        expect(plot.validationErrors).toHaveLength(0);
      });

      test('should have correct coordinates', () => {
        const plot = new UBBPlot(validBmp, 100, 200);
        expect(plot.x0).toBe(100);
        expect(plot.y0).toBe(200);
        expect(plot.bmp).toBe(validBmp);
      });

      test('should calculate area correctly', () => {
        const plot = new UBBPlot(validBmp, 0, 0);
        expect(plot.area).toBe(validBmp.area);
      });
    });

    describe('Valid BMP with invalid placement', () => {
      test('should be invalid when placed outside canvas', () => {
        const plot = new UBBPlot(validBmp, 70000, 70000);
        expect(plot.isValid).toBe(false);
        expect(plot.withinCanvas).toBe(false);
        expect(plot.validationErrors.length).toBeGreaterThan(0);
        expect(plot.validationErrors.some(error => 
          error.includes('Plot extends outside canvas bounds')
        )).toBe(true);
      });

      test('should be invalid with negative coordinates', () => {
        const plot = new UBBPlot(validBmp, -100, -100);
        expect(plot.isValid).toBe(false);
        expect(plot.validationErrors.some(error => 
          error.includes('Plot coordinates must be non-negative')
        )).toBe(true);
      });
    });

    describe('Invalid BMP (regardless of placement)', () => {
      test('should be invalid even with valid placement', () => {
        const plot = new UBBPlot(invalidBmp, 0, 0);
        expect(plot.isValid).toBe(false);
        expect(plot.allValidationErrors.length).toBeGreaterThan(0);
        expect(plot.allValidationErrors).toContain(
          'Invalid compression: 3. Must be BI_RGB (0) - uncompressed only.'
        );
      });
    });

    describe('Immutable plot creation', () => {
      test('should create new plot at different position', () => {
        const basePlot = new UBBPlot(validBmp, 0, 0);
        const newPlot = basePlot.atPosition(1000, 1000);
        
        expect(basePlot.x0).toBe(0);
        expect(basePlot.y0).toBe(0);
        expect(newPlot.x0).toBe(1000);
        expect(newPlot.y0).toBe(1000);
        expect(newPlot.bmp).toBe(basePlot.bmp);
      });
    });

    describe('Canvas boundary tests', () => {
      test('should be valid at canvas edge', () => {
        const plot = new UBBPlot(validBmp, 65000, 65000);
        expect(plot.withinCanvas).toBe(true);
      });

      test('should be invalid beyond canvas edge', () => {
        const plot = new UBBPlot(validBmp, 66000, 66000);
        expect(plot.withinCanvas).toBe(false);
        expect(plot.isValid).toBe(false);
      });
    });
  });

  describe('UBBValidator Class', () => {
    let validator: UBBValidator;

    beforeAll(() => {
      validator = new UBBValidator();
    });

    describe('Transaction validation', () => {
      test('should validate CLAIM transaction with BMP data and coordinates', () => {
        const result = validator.validateUBBTransaction(
          'CLAIM',
          Buffer.from('fake-bmp-data'),
          100,
          200
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should invalidate CLAIM transaction without BMP data', () => {
        const result = validator.validateUBBTransaction('CLAIM', undefined, 100, 200);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('CLAIM transaction must include BMP data');
      });

      test('should invalidate CLAIM transaction without coordinates', () => {
        const result = validator.validateUBBTransaction(
          'CLAIM',
          Buffer.from('fake-bmp-data'),
          undefined,
          undefined
        );
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('CLAIM transaction must specify x0 and y0 coordinates');
      });

      test('should validate RETRY-CLAIM transaction with coordinates', () => {
        const result = validator.validateUBBTransaction('RETRY-CLAIM', undefined, 100, 200);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should invalidate RETRY-CLAIM transaction without coordinates', () => {
        const result = validator.validateUBBTransaction('RETRY-CLAIM', undefined, undefined, undefined);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('RETRY-CLAIM transaction must specify new x0 and y0 coordinates');
      });

      test('should validate UPDATE transaction with BMP data and coordinates', () => {
        const result = validator.validateUBBTransaction(
          'UPDATE',
          Buffer.from('fake-bmp-data'),
          100,
          200
        );
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      test('should invalidate UPDATE transaction without BMP data', () => {
        const result = validator.validateUBBTransaction('UPDATE', undefined, 100, 200);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('UPDATE transaction must include new BMP data');
      });

      test('should validate TRANSFER transaction (no additional requirements)', () => {
        const result = validator.validateUBBTransaction('TRANSFER');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
  });

  describe('Integration Tests', () => {
    test('should validate complete UBB workflow with valid BMP', () => {
      const buffer = fs.readFileSync(uncompressedBmpPath);
      const ubbBmp = new UBBBMP(buffer);
      const plot = new UBBPlot(ubbBmp, 1000, 1000);
      const validator = new UBBValidator();
      
      const txResult = validator.validateUBBTransaction('CLAIM', buffer, 1000, 1000);
      
      expect(ubbBmp.isValid).toBe(true);
      expect(plot.isValid).toBe(true);
      expect(txResult.isValid).toBe(true);
    });

    test('should reject complete UBB workflow with invalid BMP', () => {
      const buffer = fs.readFileSync(compressedBmpPath);
      const ubbBmp = new UBBBMP(buffer);
      const plot = new UBBPlot(ubbBmp, 1000, 1000);
      const validator = new UBBValidator();
      
      const txResult = validator.validateUBBTransaction('CLAIM', buffer, 1000, 1000);
      
      expect(ubbBmp.isValid).toBe(false);
      expect(plot.isValid).toBe(false);
      expect(txResult.isValid).toBe(true); // Transaction validation passes, but BMP validation fails
    });

    test('should handle edge case coordinates', () => {
      const buffer = fs.readFileSync(uncompressedBmpPath);
      const ubbBmp = new UBBBMP(buffer);
      
      // Test at maximum valid coordinates (canvas is 65536x65536, coordinates 0-65535)
      const maxPlot = new UBBPlot(ubbBmp, 65536 - ubbBmp.width, 65536 - ubbBmp.height);
      expect(maxPlot.withinCanvas).toBe(true);
      
      // Test just beyond maximum coordinates
      const overMaxPlot = new UBBPlot(ubbBmp, 65536 - ubbBmp.width + 1, 65536 - ubbBmp.height + 1);
      expect(overMaxPlot.withinCanvas).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted BMP file gracefully', () => {
      const corruptedBuffer = Buffer.from('not a bmp file');
      const ubbBmp = new UBBBMP(corruptedBuffer);
      
      expect(ubbBmp.isValid).toBe(false);
      expect(ubbBmp.validationErrors.some(error => 
        error.includes('Failed to parse BMP file')
      )).toBe(true);
    });

    test('should provide default values for corrupted BMP', () => {
      const corruptedBuffer = Buffer.from('not a bmp file');
      const ubbBmp = new UBBBMP(corruptedBuffer);
      
      expect(ubbBmp.width).toBe(0);
      expect(ubbBmp.height).toBe(0);
      expect(ubbBmp.bitsPerPixel).toBe(0);
      expect(ubbBmp.area).toBe(0);
    });
  });

  describe('UBBValidator Transaction Factory', () => {
    let validator: UBBValidator;

    beforeAll(() => {
      validator = new UBBValidator();
    });

    test('should create CLAIM transaction', () => {
      const transaction = validator.createTransaction('CLAIM', Buffer.from('data'), 100, 200);
      expect(transaction).toBeInstanceOf(UBBClaimTransaction);
      expect(transaction.transactionType).toBe('CLAIM');
    });

    test('should create RETRY-CLAIM transaction', () => {
      const transaction = validator.createTransaction('RETRY-CLAIM', undefined, 100, 200);
      expect(transaction).toBeInstanceOf(UBBRetryClaimTransaction);
      expect(transaction.transactionType).toBe('RETRY-CLAIM');
    });

    test('should create UPDATE transaction', () => {
      const transaction = validator.createTransaction('UPDATE', Buffer.from('data'), 100, 200);
      expect(transaction).toBeInstanceOf(UBBUpdateTransaction);
      expect(transaction.transactionType).toBe('UPDATE');
    });

    test('should create TRANSFER transaction', () => {
      const transaction = validator.createTransaction('TRANSFER');
      expect(transaction).toBeInstanceOf(UBBTransferTransaction);
      expect(transaction.transactionType).toBe('TRANSFER');
    });

    test('should throw error for unknown transaction type', () => {
      expect(() => {
        validator.createTransaction('UNKNOWN' as any);
      }).toThrow('Unknown transaction type: UNKNOWN');
    });

    test('should have correct deed value', () => {
      expect(validator.deedValue).toBe(600);
    });

    test('should maintain backward compatibility with validateUBBTransaction', () => {
      // Test that the deprecated method still works
      const result = validator.validateUBBTransaction('CLAIM', Buffer.from('data'), 100, 200);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Transaction Classes Integration', () => {
    test('should work with UBBValidator createTransaction method', () => {
      const validator = new UBBValidator();
      const bmpData = Buffer.from('fake-bmp-data');
      
      // Test all transaction types
      const claim = validator.createTransaction('CLAIM', bmpData, 100, 200);
      const retryClaim = validator.createTransaction('RETRY-CLAIM', undefined, 300, 400);
      const update = validator.createTransaction('UPDATE', bmpData, 500, 600);
      const transfer = validator.createTransaction('TRANSFER');
      
      expect(claim.validate().isValid).toBe(true);
      expect(retryClaim.validate().isValid).toBe(true);
      expect(update.validate().isValid).toBe(true);
      expect(transfer.validate().isValid).toBe(true);
    });

    test('should handle invalid transactions through factory', () => {
      const validator = new UBBValidator();
      
      // Test invalid transactions
      const invalidClaim = validator.createTransaction('CLAIM', undefined, 100, 200);
      const invalidRetryClaim = validator.createTransaction('RETRY-CLAIM', undefined, undefined, undefined);
      const invalidUpdate = validator.createTransaction('UPDATE', undefined, 100, 200);
      
      expect(invalidClaim.validate().isValid).toBe(false);
      expect(invalidRetryClaim.validate().isValid).toBe(false);
      expect(invalidUpdate.validate().isValid).toBe(false);
    });
  });

  describe('UBBValidator Complete Transaction Validation', () => {
    let validator: UBBValidator;

    beforeAll(() => {
      validator = new UBBValidator();
    });

    // Helper function to create a valid Bitcoin transaction with UBB OP_RETURN
    function createValidBitcoinTxWithOpReturn(transactionType: number, x0: number, y0: number, bmpData?: Buffer): BitcoinTransaction {
      const deedInput = new BitcoinInput('deed123', 0, 600); // 600 sats deed
      const regularInput = new BitcoinInput('input123', 0, 1000); // Additional input
      
      // Create OP_RETURN data
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([transactionType]), // Transaction type
        Buffer.from([x0 & 0xFF, (x0 >> 8) & 0xFF]), // X coordinate (little endian)
        Buffer.from([y0 & 0xFF, (y0 >> 8) & 0xFF]), // Y coordinate (little endian)
        ...(transactionType === 0x01 || transactionType === 0x03 ? [Buffer.from([0x60])] : []),
        bmpData || Buffer.alloc(0) // BMP data (if any)
      ]);
      
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, opReturnData);
      const changeOutput = new BitcoinOutput(1400, Buffer.from('change script')); // 1600 - 200 fee
      
      return new BitcoinTransaction('tx123', [deedInput, regularInput], [opReturnOutput, changeOutput]);
    }

    test('should create UBB transaction with Bitcoin validation', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, Buffer.from('data'));
      const ubbTx = validator.createUBBTransaction(bitcoinTx);
      
      expect(ubbTx).toBeInstanceOf(UBBTransaction);
      expect(ubbTx.transactionType).toBe('CLAIM');
      expect(ubbTx.bitcoinTransaction).toBe(bitcoinTx);
    });

    test('should validate complete UBB transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, Buffer.from('data'));
      const result = validator.validateUBBTransactionComplete(bitcoinTx);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should invalidate complete UBB transaction without deed UTXO', () => {
      const input = new BitcoinInput('input123', 0, 1000);
      const opReturnData = Buffer.concat([
        Buffer.from([0x13, 0x37]), // Magic bytes
        Buffer.from([0x01]), // Version
        Buffer.from([0x01]), // Transaction type (CLAIM)
        Buffer.from([100 & 0xFF, (100 >> 8) & 0xFF]), // X coordinate
        Buffer.from([200 & 0xFF, (200 >> 8) & 0xFF]), // Y coordinate
        Buffer.from([0x60]), // empty URI
        Buffer.from('data') // BMP data
      ]);
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, opReturnData);
      const changeOutput = new BitcoinOutput(800, Buffer.from('change script'));
      const bitcoinTx = new BitcoinTransaction('tx123', [input], [opReturnOutput, changeOutput]);
      
      const result = validator.validateUBBTransactionComplete(bitcoinTx);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Transaction must include a deed UTXO of 600 sats');
    });

    test('should validate TRANSFER transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x04, 0, 0);
      const result = validator.validateUBBTransactionComplete(bitcoinTx);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate RETRY-CLAIM transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x02, 100, 200);
      const result = validator.validateUBBTransactionComplete(bitcoinTx);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should validate UPDATE transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x03, 100, 200, Buffer.from('data'));
      const result = validator.validateUBBTransactionComplete(bitcoinTx);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should check if Bitcoin transaction is UBB transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, Buffer.from('data'));
      const isUBB = validator.isUBBTransaction(bitcoinTx);
      
      expect(isUBB).toBe(true);
    });

    test('should check if Bitcoin transaction is UBB transaction with deed UTXOs', () => {
      const deedInput = new BitcoinInput('deed123', 0, 600);
      const output = new BitcoinOutput(500, Buffer.from('script'));
      const bitcoinTx = new BitcoinTransaction('tx123', [deedInput], [output]);
      
      const isUBB = validator.isUBBTransaction(bitcoinTx, ['deed123:0']);
      
      expect(isUBB).toBe(true);
    });
  });
});

// Helper functions for BMP creation
function create24BitBMP(width: number, height: number): Buffer {
  const headerSize = 54;
  const bytesPerPixel = 3;
  const stride = Math.ceil((width * bytesPerPixel) / 4) * 4;
  const pixelDataSize = stride * height;
  const fileSize = headerSize + pixelDataSize;

  const buffer = Buffer.alloc(fileSize);
  
  // BMP Header
  buffer.write('BM', 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(headerSize, 10);

  // DIB Header
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22); // Positive = bottom-up
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelDataSize, 34);
  buffer.writeInt32LE(0, 38);
  buffer.writeInt32LE(0, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  return buffer;
}

function create32BitBMP(width: number, height: number): Buffer {
  const headerSize = 54;
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel; // Always aligned for 32-bit
  const pixelDataSize = stride * height;
  const fileSize = headerSize + pixelDataSize;

  const buffer = Buffer.alloc(fileSize);
  
  buffer.write('BM', 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(headerSize, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(32, 28); // 32-bit
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelDataSize, 34);
  buffer.writeInt32LE(0, 38);
  buffer.writeInt32LE(0, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  return buffer;
}

function createTopDownBMP(width: number, height: number): Buffer {
  const headerSize = 54;
  const bytesPerPixel = 3;
  const stride = Math.ceil((width * bytesPerPixel) / 4) * 4;
  const pixelDataSize = stride * height;
  const fileSize = headerSize + pixelDataSize;

  const buffer = Buffer.alloc(fileSize);
  
  buffer.write('BM', 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(headerSize, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(-height, 22); // NEGATIVE = top-down
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelDataSize, 34);
  buffer.writeInt32LE(0, 38);
  buffer.writeInt32LE(0, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  return buffer;
}

function createBottomUpBMP(width: number, height: number): Buffer {
  return create24BitBMP(width, height); // Same as regular 24-bit
}
