/**
 * Browser entry point for UBB Transaction Validator
 * Validates complete Bitcoin transactions against UBB protocol rules
 */

import * as bitcore from 'bitcore-lib';
import { 
  UBBTransactionValidator, 
  TransactionValidationResult 
} from '../validators/transaction-validator-shared';

/**
 * Browser wrapper that parses hex and delegates to shared validator
 */
class UBBTransactionValidatorBrowser {
  /**
   * Validate a raw Bitcoin transaction hex string
   */
  static validateTransaction(txHex: string): TransactionValidationResult {
    const errors: string[] = [];
    
    const errorResult: TransactionValidationResult = {
      isValid: false,
      errors,
      warnings: [],
      details: {
        txid: null,
        size: null,
        hasOpReturn: false,
        opReturnData: null,
        deedUTXOs: [],
        hasSingleDeedUTXO: false,
        bmpData: null,
        transactionType: null,
      }
    };

    try {
      // Remove any whitespace
      txHex = txHex.trim().replace(/\s+/g, '');
      
      // Validate hex format
      if (!/^[0-9a-fA-F]+$/.test(txHex)) {
        errors.push('Invalid hex format: contains non-hexadecimal characters');
        return errorResult;
      }
      
      if (txHex.length < 20) {
        errors.push('Transaction hex too short to be valid');
        return errorResult;
      }
      
      // Parse transaction using bitcore-lib
      let tx: bitcore.Transaction;
      try {
        tx = new bitcore.Transaction(txHex);
      } catch (error) {
        errors.push(`Failed to parse transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return errorResult;
      }
      
      // Calculate transaction size (raw hex length / 2)
      const txSize = txHex.length / 2;
      
      // Delegate to shared validator
      return UBBTransactionValidator.validateTransaction(tx, txSize);
      
    } catch (error) {
      errors.push(`Failed to validate transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return errorResult;
    }
  }
}

// Export for module usage
export { UBBTransactionValidatorBrowser as UBBTransactionValidator };
export type { TransactionValidationResult };

// Expose to global window object for browser usage (do this after export)
declare const window: any;
if (typeof window !== 'undefined') {
  (window as any).UBBTransactionValidator = {
    validateTransaction: UBBTransactionValidatorBrowser.validateTransaction.bind(UBBTransactionValidatorBrowser),
  };
}