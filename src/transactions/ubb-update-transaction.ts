import { UBBTransactionBase } from './ubb-transaction-base';

/**
 * Validates UBB UPDATE transactions
 * 
 * UPDATE transactions require:
 * - BMP data (new plot image)
 * - x0, y0 coordinates (plot position)
 */
export class UBBUpdateTransaction extends UBBTransactionBase {
  private readonly bmpData?: Buffer;
  private readonly x0?: number;
  private readonly y0?: number;

  constructor(bmpData?: Buffer, x0?: number, y0?: number) {
    super();
    this.bmpData = bmpData;
    this.x0 = x0;
    this.y0 = y0;
  }

  get transactionType(): string {
    return 'UPDATE';
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.bmpData) {
      errors.push('UPDATE transaction must include new BMP data');
    }

    if (this.x0 === undefined || this.y0 === undefined) {
      errors.push('UPDATE transaction must specify x0 and y0 coordinates');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets the new BMP data for this update
   */
  get bmp(): Buffer | undefined {
    return this.bmpData;
  }

  /**
   * Gets the plot coordinates
   */
  get coordinates(): { x0: number | undefined; y0: number | undefined } {
    return { x0: this.x0, y0: this.y0 };
  }
}
