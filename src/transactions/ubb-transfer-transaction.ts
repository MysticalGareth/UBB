import { UBBTransactionBase } from './ubb-transaction-base';

/**
 * Validates UBB TRANSFER transactions
 * 
 * TRANSFER transactions have no OP_RETURN data requirements.
 * They only transfer ownership of an existing plot.
 */
export class UBBTransferTransaction extends UBBTransactionBase {
  constructor() {
    super();
  }

  get transactionType(): string {
    return 'TRANSFER';
  }

  validate(): { isValid: boolean; errors: string[] } {
    // TRANSFER has no OP_RETURN, so no additional validation needed
    return {
      isValid: true,
      errors: []
    };
  }
}
