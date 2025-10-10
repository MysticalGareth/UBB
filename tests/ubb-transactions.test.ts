import { 
  UBBTransactionBase,
  UBBClaimTransaction,
  UBBRetryClaimTransaction,
  UBBUpdateTransaction,
  UBBTransferTransaction
} from '../src/transactions';

describe('UBB Transaction Classes', () => {
  describe('UBBClaimTransaction', () => {
    test('should create valid claim transaction with all required data', () => {
      const bmpData = Buffer.from('fake-bmp-data');
      const transaction = new UBBClaimTransaction(bmpData, 100, 200);
      
      expect(transaction.transactionType).toBe('CLAIM');
      expect(transaction.deedValue).toBe(600);
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      expect(transaction.bmp).toBe(bmpData);
      expect(transaction.coordinates).toEqual({ x0: 100, y0: 200 });
    });

    test('should be invalid without BMP data', () => {
      const transaction = new UBBClaimTransaction(undefined, 100, 200);
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('CLAIM transaction must include BMP data');
    });

    test('should be invalid without coordinates', () => {
      const bmpData = Buffer.from('fake-bmp-data');
      const transaction = new UBBClaimTransaction(bmpData, undefined, undefined);
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('CLAIM transaction must specify x0 and y0 coordinates');
    });

    test('should be invalid with partial coordinates', () => {
      const bmpData = Buffer.from('fake-bmp-data');
      const transaction1 = new UBBClaimTransaction(bmpData, 100, undefined);
      const transaction2 = new UBBClaimTransaction(bmpData, undefined, 200);
      
      expect(transaction1.validate().isValid).toBe(false);
      expect(transaction2.validate().isValid).toBe(false);
    });

    test('should be invalid with all missing data', () => {
      const transaction = new UBBClaimTransaction();
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(2);
      expect(validation.errors).toContain('CLAIM transaction must include BMP data');
      expect(validation.errors).toContain('CLAIM transaction must specify x0 and y0 coordinates');
    });
  });

  describe('UBBRetryClaimTransaction', () => {
    test('should create valid retry-claim transaction with coordinates', () => {
      const transaction = new UBBRetryClaimTransaction(100, 200);
      
      expect(transaction.transactionType).toBe('RETRY-CLAIM');
      expect(transaction.deedValue).toBe(600);
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      expect(transaction.coordinates).toEqual({ x0: 100, y0: 200 });
    });

    test('should be invalid without coordinates', () => {
      const transaction = new UBBRetryClaimTransaction();
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('RETRY-CLAIM transaction must specify new x0 and y0 coordinates');
    });

    test('should be invalid with partial coordinates', () => {
      const transaction1 = new UBBRetryClaimTransaction(100, undefined);
      const transaction2 = new UBBRetryClaimTransaction(undefined, 200);
      
      expect(transaction1.validate().isValid).toBe(false);
      expect(transaction2.validate().isValid).toBe(false);
    });
  });

  describe('UBBUpdateTransaction', () => {
    test('should create valid update transaction with all required data', () => {
      const bmpData = Buffer.from('fake-bmp-data');
      const transaction = new UBBUpdateTransaction(bmpData, 100, 200);
      
      expect(transaction.transactionType).toBe('UPDATE');
      expect(transaction.deedValue).toBe(600);
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      
      expect(transaction.bmp).toBe(bmpData);
      expect(transaction.coordinates).toEqual({ x0: 100, y0: 200 });
    });

    test('should be invalid without BMP data', () => {
      const transaction = new UBBUpdateTransaction(undefined, 100, 200);
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('UPDATE transaction must include new BMP data');
    });

    test('should be invalid without coordinates', () => {
      const bmpData = Buffer.from('fake-bmp-data');
      const transaction = new UBBUpdateTransaction(bmpData, undefined, undefined);
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('UPDATE transaction must specify x0 and y0 coordinates');
    });

    test('should be invalid with all missing data', () => {
      const transaction = new UBBUpdateTransaction();
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(2);
      expect(validation.errors).toContain('UPDATE transaction must include new BMP data');
      expect(validation.errors).toContain('UPDATE transaction must specify x0 and y0 coordinates');
    });
  });

  describe('UBBTransferTransaction', () => {
    test('should create valid transfer transaction', () => {
      const transaction = new UBBTransferTransaction();
      
      expect(transaction.transactionType).toBe('TRANSFER');
      expect(transaction.deedValue).toBe(600);
      
      const validation = transaction.validate();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should always be valid (no requirements)', () => {
      const transaction = new UBBTransferTransaction();
      
      // Multiple validations should always pass
      for (let i = 0; i < 5; i++) {
        const validation = transaction.validate();
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });
  });

  describe('UBBTransactionBase', () => {
    test('should have consistent deed value across all transaction types', () => {
      const claim = new UBBClaimTransaction(Buffer.from('data'), 0, 0);
      const retryClaim = new UBBRetryClaimTransaction(0, 0);
      const update = new UBBUpdateTransaction(Buffer.from('data'), 0, 0);
      const transfer = new UBBTransferTransaction();
      
      expect(claim.deedValue).toBe(600);
      expect(retryClaim.deedValue).toBe(600);
      expect(update.deedValue).toBe(600);
      expect(transfer.deedValue).toBe(600);
    });
  });

  describe('Transaction Type Consistency', () => {
    test('should have unique transaction types', () => {
      const claim = new UBBClaimTransaction();
      const retryClaim = new UBBRetryClaimTransaction();
      const update = new UBBUpdateTransaction();
      const transfer = new UBBTransferTransaction();
      
      const types = [
        claim.transactionType,
        retryClaim.transactionType,
        update.transactionType,
        transfer.transactionType
      ];
      
      const uniqueTypes = new Set(types);
      expect(uniqueTypes.size).toBe(types.length);
    });

    test('should have expected transaction type names', () => {
      expect(new UBBClaimTransaction().transactionType).toBe('CLAIM');
      expect(new UBBRetryClaimTransaction().transactionType).toBe('RETRY-CLAIM');
      expect(new UBBUpdateTransaction().transactionType).toBe('UPDATE');
      expect(new UBBTransferTransaction().transactionType).toBe('TRANSFER');
    });
  });

  describe('Edge Cases', () => {
    test('should handle zero coordinates', () => {
      const claim = new UBBClaimTransaction(Buffer.from('data'), 0, 0);
      const retryClaim = new UBBRetryClaimTransaction(0, 0);
      const update = new UBBUpdateTransaction(Buffer.from('data'), 0, 0);
      
      expect(claim.validate().isValid).toBe(true);
      expect(retryClaim.validate().isValid).toBe(true);
      expect(update.validate().isValid).toBe(true);
    });

    test('should handle large coordinates', () => {
      const claim = new UBBClaimTransaction(Buffer.from('data'), 999999, 999999);
      const retryClaim = new UBBRetryClaimTransaction(999999, 999999);
      const update = new UBBUpdateTransaction(Buffer.from('data'), 999999, 999999);
      
      expect(claim.validate().isValid).toBe(true);
      expect(retryClaim.validate().isValid).toBe(true);
      expect(update.validate().isValid).toBe(true);
    });

    test('should handle negative coordinates', () => {
      const claim = new UBBClaimTransaction(Buffer.from('data'), -100, -200);
      const retryClaim = new UBBRetryClaimTransaction(-100, -200);
      const update = new UBBUpdateTransaction(Buffer.from('data'), -100, -200);
      
      // These should be valid at the transaction level (plot placement validation happens elsewhere)
      expect(claim.validate().isValid).toBe(true);
      expect(retryClaim.validate().isValid).toBe(true);
      expect(update.validate().isValid).toBe(true);
    });
  });
});
