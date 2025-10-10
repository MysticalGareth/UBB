/**
 * Unit tests for validator handling of multiple OP_RETURN outputs
 */

import * as bitcore from 'bitcore-lib';
import { UBBTransactionValidator } from '../src/validators/transaction-validator-shared';

describe('Multi-OP_RETURN Validator Tests', () => {
  test('Multiple UBB OP_RETURNs are rejected', () => {
    // Create a transaction with 2 UBB OP_RETURNs
    const tx = new bitcore.Transaction();
    
    // Add dummy input
    tx.from({
      txId: '0000000000000000000000000000000000000000000000000000000000000000',
      outputIndex: 0,
      script: '76a914' + '00'.repeat(20) + '88ac',
      satoshis: 100000
    });
    
    // Add first UBB OP_RETURN
    const ubbData1 = Buffer.concat([
      Buffer.from('1337', 'hex'), // Magic
      Buffer.from('01', 'hex'),   // Version
      Buffer.from('01', 'hex'),   // Type (1=CLAIM)
      Buffer.from('03e8', 'hex'), // x = 1000 (little-endian)
      Buffer.from('03e8', 'hex'), // y = 1000 (little-endian)
      Buffer.from('60', 'hex')    // CBOR empty text string
    ]);
    const ubbScript1 = bitcore.Script.buildDataOut(ubbData1);
    tx.addOutput(new bitcore.Transaction.Output({
      script: ubbScript1,
      satoshis: 0
    }));
    
    // Add second UBB OP_RETURN (different coords)
    const ubbData2 = Buffer.concat([
      Buffer.from('1337', 'hex'), // Magic
      Buffer.from('01', 'hex'),   // Version
      Buffer.from('01', 'hex'),   // Type (1=CLAIM)
      Buffer.from('07d0', 'hex'), // x = 2000 (little-endian)
      Buffer.from('07d0', 'hex'), // y = 2000 (little-endian)
      Buffer.from('60', 'hex')    // CBOR empty text string
    ]);
    const ubbScript2 = bitcore.Script.buildDataOut(ubbData2);
    tx.addOutput(new bitcore.Transaction.Output({
      script: ubbScript2,
      satoshis: 0
    }));
    
    // Add deed output
    const deedScript = bitcore.Script.fromHex('76a914' + '00'.repeat(20) + '88ac');
    tx.addOutput(new bitcore.Transaction.Output({
      script: deedScript,
      satoshis: 600
    }));
    
    // Validate the transaction
    const result = UBBTransactionValidator.validateTransaction(tx);
    
    // Should be invalid - multiple UBB OP_RETURNs
    expect(result.isValid).toBe(false);
    expect(result.warnings.some(w => w.includes('2 UBB OP_RETURN outputs'))).toBe(true);
  });

  test('UBB OP_RETURN followed by non-UBB OP_RETURN is accepted', () => {
    // This is the critical protocol behavior: non-UBB OP_RETURNs should not interfere
    const tx = new bitcore.Transaction();
    
    // Add dummy input
    tx.from({
      txId: '0000000000000000000000000000000000000000000000000000000000000000',
      outputIndex: 0,
      script: '76a914' + '00'.repeat(20) + '88ac',
      satoshis: 100000
    });
    
    // Add first OP_RETURN (UBB TRANSFER data)
    const ubbData = Buffer.concat([
      Buffer.from('1337', 'hex'), // Magic
      Buffer.from('01', 'hex'),   // Version
      Buffer.from('04', 'hex'),   // Type (4=TRANSFER)
      Buffer.from('03e8', 'hex'), // x = 1000 (little-endian)
      Buffer.from('03e8', 'hex')  // y = 1000 (little-endian)
      // TRANSFER doesn't require URI/BMP beyond coordinates
    ]);
    const ubbScript = bitcore.Script.buildDataOut(ubbData);
    tx.addOutput(new bitcore.Transaction.Output({
      script: ubbScript,
      satoshis: 0
    }));
    
    // Add second OP_RETURN (non-UBB data)
    const nonUbbData = Buffer.from('This is not a UBB transaction');
    const nonUbbScript = bitcore.Script.buildDataOut(nonUbbData);
    tx.addOutput(new bitcore.Transaction.Output({
      script: nonUbbScript,
      satoshis: 0
    }));
    
    // Add deed output
    const deedScript = bitcore.Script.fromHex('76a914' + '00'.repeat(20) + '88ac');
    tx.addOutput(new bitcore.Transaction.Output({
      script: deedScript,
      satoshis: 600
    }));
    
    // Validate the transaction
    const result = UBBTransactionValidator.validateTransaction(tx);
    
    // Should be VALID - only the UBB OP_RETURN (with magic bytes) is counted
    // The non-UBB OP_RETURN should be ignored
    if (!result.isValid) {
      throw new Error(`Validation failed. Errors: ${JSON.stringify(result.errors)}, Warnings: ${JSON.stringify(result.warnings)}`);
    }
    expect(result.isValid).toBe(true);
    expect(result.details.hasOpReturn).toBe(true);
    expect(result.details.transactionType).toBe('TRANSFER');
  });

  test('Non-UBB OP_RETURN before UBB OP_RETURN is handled correctly', () => {
    // Create a transaction with non-UBB first, then UBB
    const tx = new bitcore.Transaction();
    
    // Add dummy input
    tx.from({
      txId: '0000000000000000000000000000000000000000000000000000000000000000',
      outputIndex: 0,
      script: '76a914' + '00'.repeat(20) + '88ac',
      satoshis: 100000
    });
    
    // Add first OP_RETURN (non-UBB)
    const nonUbbData = Buffer.from('Random data');
    const nonUbbScript = bitcore.Script.buildDataOut(nonUbbData);
    tx.addOutput(new bitcore.Transaction.Output({
      script: nonUbbScript,
      satoshis: 0
    }));
    
    // Add second OP_RETURN (UBB CLAIM data)
    const ubbData = Buffer.concat([
      Buffer.from('1337', 'hex'), // Magic
      Buffer.from('01', 'hex'),   // Version
      Buffer.from('01', 'hex'),   // Type (1=CLAIM)
      Buffer.from('03e8', 'hex'), // x = 1000 (little-endian)
      Buffer.from('03e8', 'hex'), // y = 1000 (little-endian)
      Buffer.from('60', 'hex')    // CBOR empty text string
    ]);
    const ubbScript = bitcore.Script.buildDataOut(ubbData);
    tx.addOutput(new bitcore.Transaction.Output({
      script: ubbScript,
      satoshis: 0
    }));
    
    // Add deed output
    const deedScript = bitcore.Script.fromHex('76a914' + '00'.repeat(20) + '88ac');
    tx.addOutput(new bitcore.Transaction.Output({
      script: deedScript,
      satoshis: 600
    }));
    
    // Validate the transaction
    const result = UBBTransactionValidator.validateTransaction(tx);
    
    // The validator extracts the FIRST OP_RETURN, which is non-UBB
    // So it should fail to find valid UBB data
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid magic bytes'))).toBe(true);
  });
});
