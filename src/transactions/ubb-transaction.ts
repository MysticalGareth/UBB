import { BitcoinTransaction } from '../bitcoin';
import { 
  UBBTransactionBase,
  UBBClaimTransaction,
  UBBRetryClaimTransaction,
  UBBUpdateTransaction,
  UBBTransferTransaction,
  UBBOpReturnData
} from './index';

/**
 * High-level UBB transaction validation that applies across all transaction types
 * 
 * This class handles Bitcoin transaction-level validation such as:
 * - Ensuring there is a deed UTXO
 * - Validating OP_RETURN output structure
 * - Checking transaction fees
 * - Validating transaction structure
 * - Parsing OP_RETURN data to determine transaction type and parameters
 */
export class UBBTransaction {
  private readonly _bitcoinTx: BitcoinTransaction;
  private readonly _opReturnData: UBBOpReturnData | null;
  private readonly _specificTransaction: UBBTransactionBase | null;
  private readonly _deedValue: number = 600; // sats

  constructor(bitcoinTx: BitcoinTransaction) {
    this._bitcoinTx = bitcoinTx;
    this._opReturnData = UBBOpReturnData.fromBitcoinTransaction(bitcoinTx);
    this._specificTransaction = this._createSpecificTransaction();
  }

  /**
   * Gets the underlying Bitcoin transaction
   */
  get bitcoinTransaction(): BitcoinTransaction {
    return this._bitcoinTx;
  }

  /**
   * Gets the parsed OP_RETURN data
   */
  get opReturnData(): UBBOpReturnData | null {
    return this._opReturnData;
  }

  /**
   * Gets the specific UBB transaction type (created from OP_RETURN data)
   */
  get specificTransaction(): UBBTransactionBase | null {
    return this._specificTransaction;
  }

  /**
   * Gets the transaction type from OP_RETURN data
   */
  get transactionType(): string {
    if (!this._opReturnData) {
      return 'UNKNOWN';
    }
    return this._opReturnData.transactionTypeString;
  }

  /**
   * Gets the deed value required
   */
  get deedValue(): number {
    return this._deedValue;
  }

  /**
   * Gets the coordinates from OP_RETURN data
   */
  get coordinates(): { x0: number; y0: number } | null {
    if (!this._opReturnData) {
      return null;
    }
    return { x0: this._opReturnData.x0, y0: this._opReturnData.y0 };
  }

  /**
   * Gets the BMP data from OP_RETURN data
   */
  get bmpData(): Buffer | null {
    if (!this._opReturnData) {
      return null;
    }
    return this._opReturnData.bmpData;
  }

  /**
   * Creates the specific transaction type based on OP_RETURN data
   */
  private _createSpecificTransaction(): UBBTransactionBase | null {
    if (!this._opReturnData || !this._opReturnData.isValid) {
      return null;
    }

    const coords = this.coordinates;
    const bmpData = this.bmpData;

    switch (this._opReturnData.transactionTypeString) {
      case 'CLAIM':
        return new UBBClaimTransaction(bmpData || undefined, coords?.x0, coords?.y0);
      case 'RETRY-CLAIM':
        return new UBBRetryClaimTransaction(coords?.x0, coords?.y0);
      case 'UPDATE':
        return new UBBUpdateTransaction(bmpData || undefined, coords?.x0, coords?.y0);
      case 'TRANSFER':
        return new UBBTransferTransaction();
      default:
        return null;
    }
  }

  /**
   * Comprehensive validation of the UBB transaction
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate Bitcoin transaction structure
    const bitcoinValidation = this._validateBitcoinTransaction();
    errors.push(...bitcoinValidation.errors);

    // Validate OP_RETURN data parsing
    const opReturnValidation = this._validateOpReturnData();
    errors.push(...opReturnValidation.errors);

    // Validate specific transaction type requirements
    if (this._specificTransaction) {
      const specificValidation = this._specificTransaction.validate();
      errors.push(...specificValidation.errors);
    }

    // Validate deed UTXO presence
    const deedValidation = this._validateDeedUtxo();
    errors.push(...deedValidation.errors);

    // Validate OP_RETURN structure
    const opReturnStructureValidation = this._validateOpReturnStructure();
    errors.push(...opReturnStructureValidation.errors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates basic Bitcoin transaction structure
   */
  private _validateBitcoinTransaction(): { errors: string[] } {
    const errors: string[] = [];

    if (this._bitcoinTx.inputs.length === 0) {
      errors.push('Transaction must have at least one input');
    }

    if (this._bitcoinTx.outputs.length === 0) {
      errors.push('Transaction must have at least one output');
    }

    if (this._bitcoinTx.fee < 0) {
      errors.push('Transaction fee cannot be negative');
    }

    if (this._bitcoinTx.totalInputValue < this._bitcoinTx.totalOutputValue) {
      errors.push('Transaction inputs must cover all outputs and fees');
    }

    return { errors };
  }

  /**
   * Validates that there is a deed UTXO (600 sats)
   */
  private _validateDeedUtxo(): { errors: string[] } {
    const errors: string[] = [];

    // Check if any input has the deed value
    const hasDeedUtxo = this._bitcoinTx.inputs.some(input => input.value === this._deedValue);
    
    if (!hasDeedUtxo) {
      errors.push(`Transaction must include a deed UTXO of ${this._deedValue} sats`);
    }

    return { errors };
  }

  /**
   * Validates OP_RETURN data parsing
   */
  private _validateOpReturnData(): { errors: string[] } {
    const errors: string[] = [];

    if (!this._opReturnData) {
      errors.push('Failed to parse OP_RETURN data');
    } else if (!this._opReturnData.isValid) {
      errors.push(...this._opReturnData.errors);
    }

    return { errors };
  }

  /**
   * Validates OP_RETURN output structure
   */
  private _validateOpReturnStructure(): { errors: string[] } {
    const errors: string[] = [];

    // UBB transactions should have exactly one OP_RETURN output
    if (this._bitcoinTx.opReturnOutputs.length === 0) {
      errors.push('UBB transaction must have exactly one OP_RETURN output');
    } else if (this._bitcoinTx.opReturnOutputs.length > 1) {
      errors.push('UBB transaction must have at most one OP_RETURN output');
    } else {
      // Validate OP_RETURN output value (should be 0)
      const opReturnOutput = this._bitcoinTx.opReturnOutputs[0];
      if (opReturnOutput.value !== 0) {
        errors.push('OP_RETURN output must have 0 value');
      }
    }

    return { errors };
  }

  /**
   * Factory method to create UBB transaction from Bitcoin transaction
   * The transaction type and parameters are determined from the OP_RETURN data
   */
  static create(bitcoinTx: BitcoinTransaction): UBBTransaction {
    return new UBBTransaction(bitcoinTx);
  }

  /**
   * Gets validation report with detailed breakdown
   */
  getValidationReport(): {
    isValid: boolean;
    errors: string[];
    bitcoinValidation: { isValid: boolean; errors: string[] };
    opReturnDataValidation: { isValid: boolean; errors: string[] };
    specificValidation: { isValid: boolean; errors: string[] };
    deedValidation: { isValid: boolean; errors: string[] };
    opReturnStructureValidation: { isValid: boolean; errors: string[] };
  } {
    const bitcoinValidation = this._validateBitcoinTransaction();
    const opReturnDataValidation = this._validateOpReturnData();
    const specificValidation = this._specificTransaction ? this._specificTransaction.validate() : { isValid: false, errors: ['No specific transaction created'] };
    const deedValidation = this._validateDeedUtxo();
    const opReturnStructureValidation = this._validateOpReturnStructure();

    const allErrors = [
      ...bitcoinValidation.errors,
      ...opReturnDataValidation.errors,
      ...specificValidation.errors,
      ...deedValidation.errors,
      ...opReturnStructureValidation.errors
    ];

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      bitcoinValidation: {
        isValid: bitcoinValidation.errors.length === 0,
        errors: bitcoinValidation.errors
      },
      opReturnDataValidation: {
        isValid: opReturnDataValidation.errors.length === 0,
        errors: opReturnDataValidation.errors
      },
      specificValidation: {
        isValid: specificValidation.isValid,
        errors: specificValidation.errors
      },
      deedValidation: {
        isValid: deedValidation.errors.length === 0,
        errors: deedValidation.errors
      },
      opReturnStructureValidation: {
        isValid: opReturnStructureValidation.errors.length === 0,
        errors: opReturnStructureValidation.errors
      }
    };
  }
}
