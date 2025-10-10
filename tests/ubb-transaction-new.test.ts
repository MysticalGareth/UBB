import { 
  UBBTransaction,
  UBBClaimTransaction,
  UBBRetryClaimTransaction,
  UBBUpdateTransaction,
  UBBTransferTransaction
} from '../src/transactions';
import { BitcoinTransaction, BitcoinInput, BitcoinOutput } from '../src/bitcoin';

describe('UBBTransaction New Architecture', () => {
  // Helper function to create a valid Bitcoin transaction with UBB OP_RETURN
  function createValidBitcoinTxWithOpReturn(transactionType: number, x0: number, y0: number, bmpData?: Buffer, uri: string = ''): BitcoinTransaction {
    const deedInput = new BitcoinInput('deed123', 0, 600); // 600 sats deed
    const regularInput = new BitcoinInput('input123', 0, 1000); // Additional input
    
    // Create OP_RETURN data
    const cbor = (transactionType === 0x01 || transactionType === 0x03)
      ? (uri.length < 24 ? Buffer.concat([Buffer.from([0x60 + uri.length]), Buffer.from(uri)]) : Buffer.concat([Buffer.from([0x78, uri.length]), Buffer.from(uri)]))
      : Buffer.alloc(0);
    const opReturnData = Buffer.concat([
      Buffer.from([0x13, 0x37]), // Magic bytes
      Buffer.from([0x01]), // Version
      Buffer.from([transactionType]), // Transaction type
      Buffer.from([x0 & 0xFF, (x0 >> 8) & 0xFF]), // X coordinate (little endian)
      Buffer.from([y0 & 0xFF, (y0 >> 8) & 0xFF]), // Y coordinate (little endian)
      cbor,
      bmpData || Buffer.alloc(0) // BMP data (if any)
    ]);
    
    const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, opReturnData);
    const changeOutput = new BitcoinOutput(1400, Buffer.from('change script')); // 1600 - 200 fee
    
    return new BitcoinTransaction('tx123', [deedInput, regularInput], [opReturnOutput, changeOutput]);
  }

  // Helper function to create Bitcoin transaction without deed UTXO
  function createBitcoinTxWithoutDeed(transactionType: number, x0: number, y0: number, bmpData?: Buffer, uri: string = ''): BitcoinTransaction {
    const input = new BitcoinInput('input123', 0, 1000);
    
    const cbor = (transactionType === 0x01 || transactionType === 0x03)
      ? (uri.length < 24 ? Buffer.concat([Buffer.from([0x60 + uri.length]), Buffer.from(uri)]) : Buffer.concat([Buffer.from([0x78, uri.length]), Buffer.from(uri)]))
      : Buffer.alloc(0);
    const opReturnData = Buffer.concat([
      Buffer.from([0x13, 0x37]), // Magic bytes
      Buffer.from([0x01]), // Version
      Buffer.from([transactionType]), // Transaction type
      Buffer.from([x0 & 0xFF, (x0 >> 8) & 0xFF]), // X coordinate
      Buffer.from([y0 & 0xFF, (y0 >> 8) & 0xFF]), // Y coordinate
      cbor,
      bmpData || Buffer.alloc(0) // BMP data
    ]);
    
    const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, opReturnData);
    const changeOutput = new BitcoinOutput(800, Buffer.from('change script'));
    
    return new BitcoinTransaction('tx123', [input], [opReturnOutput, changeOutput]);
  }

  describe('CLAIM Transaction Validation', () => {
    test('should validate valid CLAIM transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, Buffer.from('bmp data'), 'u');
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const validation = ubbTx.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(ubbTx.transactionType).toBe('CLAIM');
      expect(ubbTx.specificTransaction).toBeInstanceOf(UBBClaimTransaction);
    });

    test('should invalidate CLAIM transaction without deed UTXO', () => {
      const bitcoinTx = createBitcoinTxWithoutDeed(0x01, 100, 200, Buffer.from('bmp data'), 'u');
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const validation = ubbTx.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Transaction must include a deed UTXO of 600 sats');
    });

    test('should invalidate CLAIM transaction with missing BMP data', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, undefined, 'u'); // No BMP data
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const validation = ubbTx.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('CLAIM transaction requires BMP data'))).toBe(true);
    });
  });

  describe('RETRY-CLAIM Transaction Validation', () => {
    test('should validate valid RETRY-CLAIM transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x02, 100, 200);
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const validation = ubbTx.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(ubbTx.transactionType).toBe('RETRY-CLAIM');
      expect(ubbTx.specificTransaction).toBeInstanceOf(UBBRetryClaimTransaction);
    });

    test('should invalidate RETRY-CLAIM transaction without deed UTXO', () => {
      const bitcoinTx = createBitcoinTxWithoutDeed(0x02, 100, 200);
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const validation = ubbTx.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Transaction must include a deed UTXO of 600 sats');
    });
  });

  describe('UPDATE Transaction Validation', () => {
    test('should validate valid UPDATE transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x03, 100, 200, Buffer.from('updated bmp data'), 'u');
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const validation = ubbTx.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(ubbTx.transactionType).toBe('UPDATE');
      expect(ubbTx.specificTransaction).toBeInstanceOf(UBBUpdateTransaction);
    });

    test('should invalidate UPDATE transaction without deed UTXO', () => {
      const bitcoinTx = createBitcoinTxWithoutDeed(0x03, 100, 200, Buffer.from('bmp data'), 'u');
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const validation = ubbTx.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Transaction must include a deed UTXO of 600 sats');
    });

    test('should invalidate UPDATE transaction with missing BMP data', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x03, 100, 200, undefined, 'u'); // No BMP data
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const validation = ubbTx.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.some(error => error.includes('UPDATE transaction requires BMP data'))).toBe(true);
    });
  });

  describe('TRANSFER Transaction Validation', () => {
    test('should validate valid TRANSFER transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x04, 0, 0);
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const validation = ubbTx.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(ubbTx.transactionType).toBe('TRANSFER');
      expect(ubbTx.specificTransaction).toBeInstanceOf(UBBTransferTransaction);
    });

    test('should invalidate TRANSFER transaction without deed UTXO', () => {
      const bitcoinTx = createBitcoinTxWithoutDeed(0x04, 0, 0);
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const validation = ubbTx.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Transaction must include a deed UTXO of 600 sats');
    });
  });

  describe('Properties and Data Access', () => {
    test('should expose Bitcoin transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, Buffer.from('data'), 'u');
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      expect(ubbTx.bitcoinTransaction).toBe(bitcoinTx);
    });

    test('should expose OP_RETURN data', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, Buffer.from('data'), 'u');
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      expect(ubbTx.opReturnData).not.toBeNull();
      expect(ubbTx.opReturnData!.isValid).toBe(true);
    });

    test('should expose coordinates', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, Buffer.from('data'));
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const coords = ubbTx.coordinates;
      expect(coords).not.toBeNull();
      expect(coords!.x0).toBe(100);
      expect(coords!.y0).toBe(200);
    });

    test('should expose BMP data', () => {
      const bmpData = Buffer.from('test bmp data');
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, bmpData);
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      expect(ubbTx.bmpData).toEqual(bmpData);
    });

    test('should return null coordinates for TRANSFER transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x04, 0, 0);
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const coords = ubbTx.coordinates;
      expect(coords).not.toBeNull(); // TRANSFER still has coordinates in OP_RETURN
      expect(coords!.x0).toBe(0);
      expect(coords!.y0).toBe(0);
    });

    test('should return null BMP data for non-BMP transactions', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x02, 100, 200); // RETRY-CLAIM
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      expect(ubbTx.bmpData).toBeNull();
    });
  });

  describe('Validation Report', () => {
    test('should provide detailed validation report for valid transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, Buffer.from('data'));
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const report = ubbTx.getValidationReport();
      
      expect(report.isValid).toBe(true);
      expect(report.errors).toHaveLength(0);
      expect(report.bitcoinValidation.isValid).toBe(true);
      expect(report.opReturnDataValidation.isValid).toBe(true);
      expect(report.specificValidation.isValid).toBe(true);
      expect(report.deedValidation.isValid).toBe(true);
      expect(report.opReturnStructureValidation.isValid).toBe(true);
    });

    test('should provide detailed validation report for invalid transaction', () => {
      const bitcoinTx = createBitcoinTxWithoutDeed(0x01, 100, 200); // No deed, no BMP
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      const report = ubbTx.getValidationReport();
      
      expect(report.isValid).toBe(false);
      expect(report.errors.length).toBeGreaterThan(0);
      expect(report.bitcoinValidation.isValid).toBe(true);
      expect(report.opReturnDataValidation.isValid).toBe(false); // Should be false due to missing BMP data
      expect(report.specificValidation.isValid).toBe(false);
      expect(report.deedValidation.isValid).toBe(false);
      expect(report.opReturnStructureValidation.isValid).toBe(true);
    });
  });

  describe('Factory Method', () => {
    test('should create UBB transaction from Bitcoin transaction', () => {
      const bitcoinTx = createValidBitcoinTxWithOpReturn(0x01, 100, 200, Buffer.from('data'));
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      expect(ubbTx).toBeInstanceOf(UBBTransaction);
      expect(ubbTx.bitcoinTransaction).toBe(bitcoinTx);
    });
  });

  describe('Edge Cases', () => {
    test('should handle transaction with invalid OP_RETURN data', () => {
      const deedInput = new BitcoinInput('deed123', 0, 600);
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, Buffer.from([0x12, 0x34])); // Invalid magic
      const bitcoinTx = new BitcoinTransaction('tx123', [deedInput], [opReturnOutput]);
      
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      expect(ubbTx.transactionType).toBe('UNKNOWN');
      expect(ubbTx.specificTransaction).toBeNull();
      expect(ubbTx.opReturnData).not.toBeNull();
      expect(ubbTx.opReturnData!.isValid).toBe(false);
    });

    test('should handle transaction with no OP_RETURN', () => {
      const deedInput = new BitcoinInput('deed123', 0, 600);
      const output = new BitcoinOutput(500, Buffer.from('script'));
      const bitcoinTx = new BitcoinTransaction('tx123', [deedInput], [output]);
      
      const ubbTx = UBBTransaction.create(bitcoinTx);
      
      expect(ubbTx.transactionType).toBe('UNKNOWN');
      expect(ubbTx.specificTransaction).toBeNull();
      expect(ubbTx.opReturnData).toBeNull();
    });
  });
});
