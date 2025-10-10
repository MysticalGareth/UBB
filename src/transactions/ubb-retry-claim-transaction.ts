import { UBBTransactionBase } from './ubb-transaction-base';

/**
 * Validates UBB RETRY-CLAIM transactions
 * 
 * RETRY-CLAIM transactions require:
 * - x0, y0 coordinates (new plot position)
 * - No BMP data (reuses existing plot)
 */
export class UBBRetryClaimTransaction extends UBBTransactionBase {
  private readonly x0?: number;
  private readonly y0?: number;

  constructor(x0?: number, y0?: number) {
    super();
    this.x0 = x0;
    this.y0 = y0;
  }

  get transactionType(): string {
    return 'RETRY-CLAIM';
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.x0 === undefined || this.y0 === undefined) {
      errors.push('RETRY-CLAIM transaction must specify new x0 and y0 coordinates');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets the new plot coordinates
   */
  get coordinates(): { x0: number | undefined; y0: number | undefined } {
    return { x0: this.x0, y0: this.y0 };
  }
}
