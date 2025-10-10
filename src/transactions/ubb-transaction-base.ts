/**
 * Base class for UBB transaction validation
 */
export abstract class UBBTransactionBase {
  protected readonly DEED_VALUE = 600; // sats

  /**
   * Validates the transaction and returns validation results
   */
  abstract validate(): { isValid: boolean; errors: string[] };

  /**
   * Gets the transaction type name
   */
  abstract get transactionType(): string;

  /**
   * Gets the deed value required for this transaction
   */
  get deedValue(): number {
    return this.DEED_VALUE;
  }
}
