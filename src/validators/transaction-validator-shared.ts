/**
 * Shared transaction validator for both browser and indexer
 * Works directly with bitcore.Transaction objects
 */

import * as bitcore from 'bitcore-lib';
import { UBBOpReturnData } from '../transactions/ubb-op-return-data';
import { UBBBMP } from '../ubb-bmp';

export interface DeedUTXO {
  txid: string;
  vout: number;
  value: number;
  address: string | null;
}

export interface TransactionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: {
    txid: string | null;
    size: number | null;
    hasOpReturn: boolean;
    opReturnData: UBBOpReturnData | null;
    deedUTXOs: DeedUTXO[];
    hasSingleDeedUTXO: boolean;
    bmpData: UBBBMP | null;
    transactionType: string | null;
  };
}

/**
 * Validates a bitcore Transaction against UBB protocol rules
 * Used by both browser and indexer to ensure consistent validation
 */
export class UBBTransactionValidator {
  private static readonly DEED_VALUE = 600; // sats

  /**
   * Validate a bitcore Transaction object
   */
  static validateTransaction(tx: bitcore.Transaction, txSize?: number): TransactionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const result: TransactionValidationResult = {
      isValid: false,
      errors,
      warnings,
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
      result.details.txid = tx.hash;
      result.details.size = txSize || null;
      
      // Check for multiple UBB OP_RETURN outputs (those with magic bytes)
      const ubbOpReturnCount = this.countUBBOpReturnOutputs(tx);
      if (ubbOpReturnCount > 1) {
        warnings.push(`Transaction contains ${ubbOpReturnCount} UBB OP_RETURN outputs - UBB data will be ignored`);
      }
      
      // Extract OP_RETURN data
      const opReturnData = this.extractOpReturnData(tx);
      result.details.hasOpReturn = opReturnData !== null;
      
      if (!opReturnData) {
        errors.push('Transaction does not contain a valid OP_RETURN output');
        return result;
      }
      
      // Parse OP_RETURN data
      try {
        const ubbOpReturn = new UBBOpReturnData(opReturnData);
        result.details.opReturnData = ubbOpReturn;
        
        if (!ubbOpReturn.isValid) {
          errors.push('Invalid OP_RETURN data:');
          ubbOpReturn.errors.forEach(err => errors.push(`  - ${err}`));
        } else {
          // Determine transaction type
          if (ubbOpReturn.isClaim) {
            result.details.transactionType = 'CLAIM';
          } else if (ubbOpReturn.isRetryClaim) {
            result.details.transactionType = 'RETRY-CLAIM';
          } else if (ubbOpReturn.isUpdate) {
            result.details.transactionType = 'UPDATE';
          } else if (ubbOpReturn.isTransfer) {
            result.details.transactionType = 'TRANSFER';
          }
          
          // Validate BMP data if present
          if (ubbOpReturn.bmpData && ubbOpReturn.bmpData.length > 0) {
            const bmp = new UBBBMP(ubbOpReturn.bmpData);
            result.details.bmpData = bmp;
            
            if (!bmp.isValid) {
              errors.push('Invalid BMP data:');
              bmp.validationErrors.forEach(err => errors.push(`  - ${err}`));
            }
            
            if (bmp.validationWarnings.length > 0) {
              bmp.validationWarnings.forEach(warn => warnings.push(`BMP: ${warn}`));
            }
          }
        }
      } catch (error) {
        errors.push(`Failed to parse OP_RETURN data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Find deed UTXOs (600 sats outputs, excluding OP_RETURN)
      result.details.deedUTXOs = this.findDeedUTXOs(tx, this.DEED_VALUE);
      result.details.hasSingleDeedUTXO = result.details.deedUTXOs.length === 1;
      
      // Validate deed UTXO requirements
      if (result.details.transactionType && ['CLAIM', 'RETRY-CLAIM', 'UPDATE'].includes(result.details.transactionType)) {
        if (result.details.deedUTXOs.length === 0) {
          errors.push('Transaction requires exactly one deed UTXO of 600 sats, but none found');
        } else if (result.details.deedUTXOs.length > 1) {
          errors.push(`Transaction requires exactly one deed UTXO of 600 sats, but ${result.details.deedUTXOs.length} found`);
        }
      }
      
      // Final validation
      result.isValid = errors.length === 0;
      
    } catch (error) {
      errors.push(`Failed to validate transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return result;
  }

  /**
   * Extract OP_RETURN data from transaction
   */
  private static extractOpReturnData(tx: bitcore.Transaction): Buffer | null {
    // Primary: using bitcore helper
    const standard = tx.outputs.find(output => output.script && output.script.isDataOut && output.script.isDataOut());
    if (standard) {
      const data = standard.script.getData();
      if (data) return data as Buffer;
    }

    // Fallback: manually parse chunks to find OP_RETURN and its pushed data
    for (const out of tx.outputs) {
      const script = out.script as bitcore.Script;
      if (!script || !script.chunks || script.chunks.length === 0) continue;
      const chunks = script.chunks;
      
      // First chunk must be OP_RETURN
      if (chunks[0] && (chunks[0].opcodenum === bitcore.Opcode.OP_RETURN)) {
        // Next chunk usually contains the pushed data buffer
        for (let i = 1; i < chunks.length; i++) {
          const ch = chunks[i];
          if (ch.buf && ch.buf.length > 0) {
            return Buffer.from(ch.buf);
          }
        }
      }
    }

    return null;
  }

  /**
   * Count OP_RETURN outputs in transaction
   */
  private static countOpReturnOutputs(tx: bitcore.Transaction): number {
    return tx.outputs.filter(out => {
      const script = out.script as bitcore.Script;
      if (!script) return false;
      
      // Check if script starts with OP_RETURN (0x6a)
      const scriptBuffer = script.toBuffer();
      return scriptBuffer.length > 0 && scriptBuffer[0] === 0x6a;
    }).length;
  }

  /**
   * Count UBB OP_RETURN outputs (those starting with UBB magic bytes 0x13 0x37)
   */
  private static countUBBOpReturnOutputs(tx: bitcore.Transaction): number {
    return tx.outputs.filter(out => {
      const script = out.script as bitcore.Script;
      if (!script) return false;
      
      // Check if script starts with OP_RETURN (0x6a)
      const scriptBuffer = script.toBuffer();
      if (scriptBuffer.length < 4 || scriptBuffer[0] !== 0x6a) return false;
      
      // Extract the data payload after OP_RETURN
      // OP_RETURN format: 0x6a [pushdata opcode] [data...]
      let dataStart = 1;
      const pushOp = scriptBuffer[1];
      
      // Handle different push opcodes
      if (pushOp === 0x4c) {
        // OP_PUSHDATA1: next byte is length
        if (scriptBuffer.length < 3) return false;
        dataStart = 3;
      } else if (pushOp === 0x4d) {
        // OP_PUSHDATA2: next 2 bytes are length
        if (scriptBuffer.length < 4) return false;
        dataStart = 4;
      } else if (pushOp === 0x4e) {
        // OP_PUSHDATA4: next 4 bytes are length
        if (scriptBuffer.length < 6) return false;
        dataStart = 6;
      } else if (pushOp > 0 && pushOp <= 0x4b) {
        // Direct push: opcode value is the length
        dataStart = 2;
      } else {
        return false;
      }
      
      // Check if data starts with UBB magic bytes (0x13 0x37)
      if (scriptBuffer.length < dataStart + 2) return false;
      return scriptBuffer[dataStart] === 0x13 && scriptBuffer[dataStart + 1] === 0x37;
    }).length;
  }

  /**
   * Public method to find deed UTXOs in a transaction
   */
  static findDeedOutputs(tx: bitcore.Transaction, deedValue: number = 600): DeedUTXO[] {
    return this.findDeedUTXOs(tx, deedValue);
  }

  /**
   * Find all deed UTXOs (outputs with specified value, excluding OP_RETURN)
   */
  private static findDeedUTXOs(tx: bitcore.Transaction, deedValue: number): DeedUTXO[] {
    const deedUTXOs: DeedUTXO[] = [];
    
    tx.outputs.forEach((output, vout) => {
      if (output.satoshis === deedValue) {
        const script = output.script as bitcore.Script;
        
        // Skip OP_RETURN outputs
        const scriptBuffer = script ? script.toBuffer() : Buffer.alloc(0);
        const isOpReturn = scriptBuffer.length > 0 && scriptBuffer[0] === 0x6a;
        if (isOpReturn) return;
        
        let address: string | null = null;
        try {
          if (script) {
            const addr = script.toAddress();
            if (addr) {
              address = addr.toString();
            }
          }
        } catch (e) {
          // Address extraction failed - leave as null
        }
        
        deedUTXOs.push({
          txid: tx.hash,
          vout,
          value: output.satoshis,
          address
        });
      }
    });

    return deedUTXOs;
  }

  /**
   * Check if a transaction is a UBB transaction
   */
  static isUBBTransaction(tx: bitcore.Transaction, knownDeedUTXOs: string[] = []): boolean {
    // Check if any input is a known UBB deed UTXO
    const hasDeedUtxo = tx.inputs.some(input => {
      const utxo = `${input.prevTxId.toString('hex')}:${input.outputIndex}`;
      return knownDeedUTXOs.includes(utxo);
    });

    if (hasDeedUtxo) {
      return true;
    }

    // Check for UBB magic bytes in OP_RETURN data
    const data = this.extractOpReturnData(tx);
    if (data && data.length >= 2) {
      const magicBytes = data.subarray(0, 2);
      return magicBytes.equals(Buffer.from([0x13, 0x37]));
    }

    return false;
  }
}
