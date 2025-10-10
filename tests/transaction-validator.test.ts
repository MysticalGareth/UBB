/**
 * Tests for transaction validator - specifically tests that would catch bitcore-lib bugs
 */

import * as bitcore from 'bitcore-lib';

// Mock window for Node.js environment
(global as any).window = {};

import { UBBTransactionValidator, TransactionValidationResult } from '../src/browser/transaction-validator';

describe('UBB Transaction Validator', () => {
  
  describe('OP_RETURN detection with OP_PUSHDATA1', () => {
    // This is the actual transaction hex from regtest that exposed the bug
    const validClaimTxHex = '0200000000010149bb9a225816b24f48a7b07a1d21a0e118c48175bf074d45020682c7768d4c200000000000fdffffff0300000000000000005f6a4c5c13370101640064006d697066733a2f2f516d54657374424d4600000000000000360000002800000002000000020000000100180000000000100000000000000000000000000000000000000000000000000000000000000000000000580200000000000016001416a525b7a94389b4542ee2a07d733f7fd1254bcd663e2500000000001600143dccac477551406c48544c60120dde22b8144c8702473044022056a703cd85df9f1f55fc1f63fa0cc8f2e7521e5f61f57e4bce850a20c2cbe2290220477b7d3221d7328182f48312db9457f0e0f1894723ec832e9046b7720c77cd5701210216ec050a1950750987903e8704da764f384aebabdb4174ce544213fff763376300000000';
    
    test('should detect OP_RETURN even when using OP_PUSHDATA1 (data > 75 bytes)', () => {
      // This test would have FAILED before the fix because bitcore-lib's isDataOut()
      // returns false for OP_RETURN scripts with OP_PUSHDATA1
      
      const result = UBBTransactionValidator.validateTransaction(validClaimTxHex);
      
      // Should find the OP_RETURN output
      expect(result.details.hasOpReturn).toBe(true);
      expect(result.errors).not.toContain('Transaction does not contain an OP_RETURN output');
    });
    
    test('should parse valid CLAIM transaction with SegWit inputs', () => {
      const result = UBBTransactionValidator.validateTransaction(validClaimTxHex);
      
      // Should parse successfully
      expect(result.details.txid).toBe('005fe876647397563b6c4541e07512617018f238e3ebd21141aa6849102e7d90');
      expect(result.details.hasOpReturn).toBe(true);
      expect(result.details.transactionType).toBe('CLAIM');
      
      // Should find OP_RETURN data
      expect(result.details.opReturnData).not.toBeNull();
      expect(result.details.opReturnData?.isValid).toBe(true);
      expect(result.details.opReturnData?.x0).toBe(100);
      expect(result.details.opReturnData?.y0).toBe(100);
      expect(result.details.opReturnData?.uri).toBe('ipfs://QmTest');
      
      // Should find deed UTXO
      expect(result.details.hasSingleDeedUTXO).toBe(true);
      expect(result.details.deedUTXOs).toHaveLength(1);
      expect(result.details.deedUTXOs[0].value).toBe(600);
      expect(result.details.deedUTXOs[0].vout).toBe(1);
      
      // Should be valid overall
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    test('should extract BMP data from OP_RETURN', () => {
      const result = UBBTransactionValidator.validateTransaction(validClaimTxHex);
      
      expect(result.details.bmpData).not.toBeNull();
      expect(result.details.bmpData?.isValid).toBe(true);
      expect(result.details.bmpData?.width).toBe(2);
      expect(result.details.bmpData?.height).toBe(2);
      expect(result.details.bmpData?.bitsPerPixel).toBe(24);
      expect(result.details.bmpData?.isUncompressed).toBe(true);
    });
  });
  
  describe('Manual OP_RETURN detection (bitcore-lib bug workaround)', () => {
    test('bitcore-lib isDataOut() returns false for OP_RETURN with OP_PUSHDATA1', () => {
      // This test documents the bitcore-lib bug
      const scriptHex = '6a4c5c13370101640064006d697066733a2f2f516d54657374424d4600000000000000360000002800000002000000020000000100180000000000100000000000000000000000000000000000000000000000000000000000000000000000';
      const script = new bitcore.Script(scriptHex);
      
      // Bug: bitcore-lib returns false even though this IS an OP_RETURN
      expect(script.isDataOut()).toBe(false);
      expect(script.classify()).toBe('Unknown');
      
      // Our workaround: manually check first byte
      const buffer = script.toBuffer();
      expect(buffer[0]).toBe(0x6a); // OP_RETURN opcode
      expect(buffer[1]).toBe(0x4c); // OP_PUSHDATA1 opcode
      expect(buffer[2]).toBe(0x5c); // Length: 92 bytes
    });
    
    test('should correctly identify OP_RETURN regardless of push opcode', () => {
      // Small data (< 76 bytes) - uses direct push
      const smallData = Buffer.from('1337010100000000', 'hex');
      const smallScript = bitcore.Script.buildDataOut(smallData);
      expect(smallScript.isDataOut()).toBe(true); // This works
      
      // Large data (> 75 bytes) - uses OP_PUSHDATA1
      const largeData = Buffer.alloc(92);
      largeData.write('1337010100000000', 'hex');
      const largeScript = bitcore.Script.buildDataOut(largeData);
      expect(largeScript.isDataOut()).toBe(false); // Bug: returns false!
      
      // Our workaround works for both
      const smallBuffer = smallScript.toBuffer();
      const largeBuffer = largeScript.toBuffer();
      expect(smallBuffer[0]).toBe(0x6a);
      expect(largeBuffer[0]).toBe(0x6a);
    });
  });
  
  describe('Deed UTXO detection', () => {
    test('should find deed UTXO and exclude OP_RETURN outputs', () => {
      const result = UBBTransactionValidator.validateTransaction(
        '0200000000010149bb9a225816b24f48a7b07a1d21a0e118c48175bf074d45020682c7768d4c200000000000fdffffff0300000000000000005f6a4c5c13370101640064006d697066733a2f2f516d54657374424d4600000000000000360000002800000002000000020000000100180000000000100000000000000000000000000000000000000000000000000000000000000000000000580200000000000016001416a525b7a94389b4542ee2a07d733f7fd1254bcd663e2500000000001600143dccac477551406c48544c60120dde22b8144c8702473044022056a703cd85df9f1f55fc1f63fa0cc8f2e7521e5f61f57e4bce850a20c2cbe2290220477b7d3221d7328182f48312db9457f0e0f1894723ec832e9046b7720c77cd5701210216ec050a1950750987903e8704da764f384aebabdb4174ce544213fff763376300000000'
      );
      
      // Should find exactly one deed UTXO (600 sats, non-OP_RETURN)
      expect(result.details.deedUTXOs).toHaveLength(1);
      expect(result.details.deedUTXOs[0].value).toBe(600);
      expect(result.details.deedUTXOs[0].vout).toBe(1); // Output 0 is OP_RETURN
      
      // Should extract address for deed UTXO
      expect(result.details.deedUTXOs[0].address).toBeTruthy();
    });
  });
  
  describe('Error cases', () => {
    test('should reject transaction without OP_RETURN', () => {
      // Simple coinbase transaction (no OP_RETURN)
      const coinbaseTx = '01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff0704ffff001d0104ffffffff0100f2052a0100000043410496b538e853519c726a2c91e61ec11600ae1390813a627c66fb8be7947be63c52da7589379515d4e0a604f8141781e62294721166bf621e73a82cbf2342c858eeac00000000';
      
      const result = UBBTransactionValidator.validateTransaction(coinbaseTx);
      
      expect(result.isValid).toBe(false);
      expect(result.details.hasOpReturn).toBe(false);
      expect(result.errors).toContain('Transaction does not contain a valid OP_RETURN output');
    });
    
    test('should reject invalid hex', () => {
      const result = UBBTransactionValidator.validateTransaction('not-hex-data');
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Invalid hex format');
    });
    
    test('should reject too-short hex', () => {
      const result = UBBTransactionValidator.validateTransaction('0102030405');
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('too short');
    });
  });
  
  describe('CLAIM transaction validation rules', () => {
    test('should require exactly one deed UTXO for CLAIM transactions', () => {
      const result = UBBTransactionValidator.validateTransaction(
        '0200000000010149bb9a225816b24f48a7b07a1d21a0e118c48175bf074d45020682c7768d4c200000000000fdffffff0300000000000000005f6a4c5c13370101640064006d697066733a2f2f516d54657374424d4600000000000000360000002800000002000000020000000100180000000000100000000000000000000000000000000000000000000000000000000000000000000000580200000000000016001416a525b7a94389b4542ee2a07d733f7fd1254bcd663e2500000000001600143dccac477551406c48544c60120dde22b8144c8702473044022056a703cd85df9f1f55fc1f63fa0cc8f2e7521e5f61f57e4bce850a20c2cbe2290220477b7d3221d7328182f48312db9457f0e0f1894723ec832e9046b7720c77cd5701210216ec050a1950750987903e8704da764f384aebabdb4174ce544213fff763376300000000'
      );
      
      expect(result.details.transactionType).toBe('CLAIM');
      expect(result.details.hasSingleDeedUTXO).toBe(true);
      expect(result.isValid).toBe(true);
    });
  });
});
