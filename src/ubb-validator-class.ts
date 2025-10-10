import { 
  UBBClaimTransaction, 
  UBBRetryClaimTransaction, 
  UBBUpdateTransaction, 
  UBBTransferTransaction,
  UBBTransactionBase,
  UBBTransaction
} from './transactions';
import { BitcoinTransaction } from './bitcoin';

/**
 * Validator for UBB transactions and protocol rules
 */
export class UBBValidator {
  private readonly DEED_VALUE = 600; // sats

  /**
   * Simulates UBB transaction validation (without actual Bitcoin transaction data)
   * @deprecated Use specific transaction classes instead
   */
  validateUBBTransaction(transactionType: 'CLAIM' | 'RETRY-CLAIM' | 'UPDATE' | 'TRANSFER', 
                        bmpData?: Buffer, x0?: number, y0?: number): { isValid: boolean; errors: string[] } {
    const transaction = this.createTransaction(transactionType, bmpData, x0, y0);
    return transaction.validate();
  }

  /**
   * Creates a transaction instance based on type
   */
  createTransaction(transactionType: 'CLAIM' | 'RETRY-CLAIM' | 'UPDATE' | 'TRANSFER', 
                   bmpData?: Buffer, x0?: number, y0?: number): UBBTransactionBase {
    switch (transactionType) {
      case 'CLAIM':
        return new UBBClaimTransaction(bmpData, x0, y0);
      case 'RETRY-CLAIM':
        return new UBBRetryClaimTransaction(x0, y0);
      case 'UPDATE':
        return new UBBUpdateTransaction(bmpData, x0, y0);
      case 'TRANSFER':
        return new UBBTransferTransaction();
      default:
        throw new Error(`Unknown transaction type: ${transactionType}`);
    }
  }

  /**
   * Gets the deed value required for UBB transactions
   */
  get deedValue(): number {
    return this.DEED_VALUE;
  }

  /**
   * Creates a complete UBB transaction with Bitcoin transaction validation
   * Transaction type and parameters are determined from OP_RETURN data
   */
  createUBBTransaction(bitcoinTx: BitcoinTransaction): UBBTransaction {
    return UBBTransaction.create(bitcoinTx);
  }

  /**
   * Validates a complete UBB transaction (Bitcoin + UBB protocol validation)
   * Transaction type and parameters are determined from OP_RETURN data
   */
  validateUBBTransactionComplete(bitcoinTx: BitcoinTransaction): { isValid: boolean; errors: string[] } {
    const ubbTx = this.createUBBTransaction(bitcoinTx);
    return ubbTx.validate();
  }

  /**
   * Checks if a Bitcoin transaction is a UBB transaction
   */
  isUBBTransaction(bitcoinTx: BitcoinTransaction, ubbDeedUTXOs: string[] = []): boolean {
    return bitcoinTx.isUBB(ubbDeedUTXOs);
  }
}