import { UBBTransactionBase } from './ubb-transaction-base';

/**
 * Validates UBB CLAIM transactions
 * 
 * CLAIM transactions require:
 * - BMP data (the plot image)
 * - x0, y0 coordinates (plot position)
 */
export class UBBClaimTransaction extends UBBTransactionBase {
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
    return 'CLAIM';
  }

  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.bmpData) {
      errors.push('CLAIM transaction must include BMP data');
    }

    if (this.x0 === undefined || this.y0 === undefined) {
      errors.push('CLAIM transaction must specify x0 and y0 coordinates');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Gets the BMP data for this claim
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
