/**
 * Transaction Builder for regtest testing
 * 
 * Builds and broadcasts UBB transactions on regtest
 */

import { BitcoinRpcClient, UTXO } from './bitcoin-rpc-client';
import { WalletManager } from './wallet-manager';
import { buildClaimOpReturnHex } from '../transactions/build-claim-opreturn';

export interface ClaimTransactionResult {
  txid: string;
  deedUTXO: string; // Format: "txid:vout"
  deedAddress: string;
  hex: string;
}

export interface TransactionInput {
  txid: string;
  vout: number;
}

export class TransactionBuilder {
  private readonly rpcClient: BitcoinRpcClient;
  private readonly walletManager: WalletManager;
  private readonly DEED_AMOUNT = 0.000006; // 600 sats in BTC
  private readonly feeRate: number; // sat/vByte (default: 1)
  private readonly SMALL_TX_FEE = 0.000002; // 200 sats for small transactions (non-CLAIM)

  constructor(rpcClient: BitcoinRpcClient, walletManager: WalletManager, feeRate: number = 1) {
    this.rpcClient = rpcClient;
    this.walletManager = walletManager;
    this.feeRate = feeRate;
  }


  /**
   * Build and broadcast a CLAIM transaction
   * 
   * @param x X coordinate (0-65534)
   * @param y Y coordinate (0-65534)
   * @param uri URI string (can be empty)
   * @param bmpHex BMP file as hex string (no 0x prefix)
   * @param fundingUTXO Optional UTXO to use as input (if not provided, will find one)
   * @param changeAddress Optional change address (if not provided, will create one)
   * @param deedAddress Optional deed address (if not provided, will create one)
   * @param broadcast Whether to broadcast the transaction (default: true)
   * @returns Transaction result with txid and deed UTXO info
   */
  async buildClaimTransaction(
    x: number,
    y: number,
    uri: string,
    bmpHex: string,
    fundingUTXO?: UTXO,
    changeAddress?: string,
    deedAddress?: string,
    broadcast: boolean = true
  ): Promise<ClaimTransactionResult> {
    // Build the OP_RETURN payload
    const opReturnResult = buildClaimOpReturnHex(x, y, uri, bmpHex);
    
    if (!opReturnResult.ok) {
      throw new Error(`Failed to build OP_RETURN: ${JSON.stringify(opReturnResult.errors)}`);
    }

    // Get or create addresses
    if (!changeAddress) {
      changeAddress = await this.rpcClient.getNewAddress();
    }
    if (!deedAddress) {
      deedAddress = await this.rpcClient.getNewAddress();
    }

    // Pre-lock sweep: lock ANY existing 600-sat deed UTXOs (confirmed only)
    // This prevents fundrawtransaction from selecting deed UTXOs as additional inputs
    // Note: We only lock confirmed deeds here; 0-conf deeds are locked when created
    try {
      const existingUTXOs = await this.rpcClient.listUnspent(1);
      const deedOutputsToLock = existingUTXOs
        .filter((u) => u.amount === this.DEED_AMOUNT)
        .map((u) => ({ txid: u.txid, vout: u.vout }));
      if (deedOutputsToLock.length > 0) {
        await this.rpcClient.lockUnspent(false, deedOutputsToLock);
      }
    } catch (error) {
      console.warn(
        `Warning: Pre-lock sweep failed; deed UTXOs might be selectable: ${
          error instanceof Error ? error.message : 'unknown'
        }`
      );
    }

    // Get or find funding UTXO
    let inputUTXO: UTXO;
    if (fundingUTXO) {
      inputUTXO = fundingUTXO;
    } else {
      // Need enough for deed + fee (fundrawtransaction will calculate exact amount)
      // Use conservative estimate: deed (600) + typical fee (500-1000)
      const minAmountBTC = this.DEED_AMOUNT + 0.00001; // 600 + 1000 sats
      const minAmount = Math.ceil(minAmountBTC * 100000000); // Convert to sats
      inputUTXO = await this.walletManager.getSpendableUTXO(minAmount);
    }

    // CRITICAL SAFETY CHECK: Verify input is not a deed UTXO (600 sats)
    // This prevents accidentally spending a deed and bricking a plot
    if (inputUTXO.amount === this.DEED_AMOUNT) {
      throw new Error(
        `❌ SAFETY CHECK FAILED: Input UTXO ${inputUTXO.txid}:${inputUTXO.vout} is a deed (${this.DEED_AMOUNT} BTC / 600 sats). ` +
        `Spending this would brick a plot! Please ensure your wallet has non-deed UTXOs available.`
      );
    }

    // Build transaction with explicit input and required outputs
    const inputs = [{ txid: inputUTXO.txid, vout: inputUTXO.vout }];
    const outputs = [
      { data: opReturnResult.hex },      // OP_RETURN
      { [deedAddress]: this.DEED_AMOUNT } // 600 sat deed
      // Change will be added by fundrawtransaction
    ];

    // Create initial raw transaction
    const rawTx = await this.rpcClient.createRawTransaction(inputs, outputs);

    // Use fundrawtransaction to calculate fee and add change
    // This uses vBytes instead of raw bytes for more accurate SegWit fees
    const feeRate = this.feeRate * 0.00001; // Convert sat/vByte to BTC/kB (0.00001 BTC/kB)
    const funded = await this.rpcClient.fundRawTransaction(rawTx, {
      add_inputs: true,      // Allow adding more inputs if needed
      changeAddress: changeAddress,
      feeRate: feeRate       // BTC/kB fee rate
    });

    // Decode the funded transaction to find the deed output position
    const decodedFunded = await this.rpcClient.decodeRawTransaction(funded.hex);

    // Sign the funded transaction
    const signedResult = await this.rpcClient.signRawTransactionWithWallet(funded.hex);
    
    if (!signedResult.complete) {
      throw new Error('Failed to sign transaction');
    }

    let txid: string;
    let deedVout: number;
    
    if (broadcast) {
      // FINAL SAFETY CHECK: Verify transaction inputs before broadcasting
      // Decode the transaction to check all inputs
      const decodedTx = await this.rpcClient.decodeRawTransaction(signedResult.hex);
      
      for (const input of decodedTx.vin) {
        // Get the referenced transaction to check the output amount
        try {
          const prevTx = await this.rpcClient.getRawTransaction(input.txid, true);
          const prevOutput = prevTx.vout[input.vout];
          
          // Check if this input is a deed UTXO (exactly 600 sats)
          if (prevOutput.value === this.DEED_AMOUNT) {
            throw new Error(
              `❌ CRITICAL: Transaction attempts to spend deed UTXO ${input.txid}:${input.vout} (${this.DEED_AMOUNT} BTC / 600 sats). ` +
              `This would BRICK a plot! Transaction NOT broadcasted. ` +
              `Please check your wallet UTXOs and ensure deed outputs are not selected as inputs.`
            );
          }
        } catch (error) {
          // If we can't get the previous transaction, it might be in mempool or not exist
          // In this case, we should be cautious
          if (error instanceof Error && error.message.includes('BRICK')) {
            throw error; // Re-throw our own error
          }
          console.warn(`Warning: Could not verify input ${input.txid}:${input.vout}`);
        }
      }
      
      // Broadcast transaction
      txid = await this.rpcClient.sendRawTransaction(signedResult.hex);
      
      // Find the deed UTXO (fundrawtransaction can reorder outputs, so we can't assume vout 1)
      // We already have decodedFunded from earlier
      deedVout = -1;
      for (let i = 0; i < decodedFunded.vout.length; i++) {
        const output = decodedFunded.vout[i];
        if (output.value === this.DEED_AMOUNT) {
          deedVout = i;
          break;
        }
      }
      
      if (deedVout === -1) {
        throw new Error(`Could not find deed UTXO (${this.DEED_AMOUNT} BTC) in transaction ${txid}`);
      }
      
      const deedUTXO = `${txid}:${deedVout}`;
      
      // Lock the deed UTXO to prevent accidental spending
      try {
        const lockResult = await this.rpcClient.lockUnspent(false, [{ txid, vout: deedVout }]);
        if (!lockResult) {
          throw new Error(`lockUnspent returned false`);
        }
        console.log(`Created CLAIM transaction ${txid} with deed UTXO ${deedUTXO} (locked)`);
      } catch (error) {
        // If locking fails, this is critical - fundrawtransaction might select this deed!
        console.error(`❌ CRITICAL: Failed to lock deed UTXO ${deedUTXO}: ${error instanceof Error ? error.message : 'unknown'}`);
        console.error(`This deed may be accidentally spent by future transactions!`);
        throw new Error(`Failed to lock deed UTXO ${deedUTXO}: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    } else {
      // Calculate txid from hex without broadcasting
      const txBuffer = Buffer.from(signedResult.hex, 'hex');
      const crypto = require('crypto');
      const hash1 = crypto.createHash('sha256').update(txBuffer).digest();
      const hash2 = crypto.createHash('sha256').update(hash1).digest();
      txid = hash2.reverse().toString('hex');
      
      console.log(`Built CLAIM transaction ${txid} (not broadcasted)`);
      
      // Find the deed UTXO position
      deedVout = -1;
      for (let i = 0; i < decodedFunded.vout.length; i++) {
        const output = decodedFunded.vout[i];
        if (output.value === this.DEED_AMOUNT) {
          deedVout = i;
          break;
        }
      }
      
      if (deedVout === -1) {
        throw new Error(`Could not find deed UTXO (${this.DEED_AMOUNT} BTC) in transaction ${txid}`);
      }
    }
    
    // deedVout is set in both broadcast and non-broadcast paths above
    const deedUTXO = `${txid}:${deedVout}`;

    return {
      txid,
      deedUTXO,
      deedAddress,
      hex: signedResult.hex
    };
  }

  /**
   * Build a raw transaction without broadcasting (for testing invalid transactions)
   */
  async buildRawTransaction(
    inputs: TransactionInput[],
    outputs: Record<string, number | string>[]
  ): Promise<string> {
    return this.rpcClient.createRawTransaction(inputs, outputs);
  }

  /**
   * Sign a raw transaction
   */
  async signTransaction(hex: string): Promise<string> {
    const result = await this.rpcClient.signRawTransactionWithWallet(hex);
    if (!result.complete) {
      throw new Error('Failed to sign transaction');
    }
    return result.hex;
  }

  /**
   * Broadcast a signed transaction
   */
  async broadcastTransaction(hex: string): Promise<string> {
    return this.rpcClient.sendRawTransaction(hex);
  }

  /**
   * Get raw transaction (verbose for decoded format)
   */
  async getRawTransaction(txid: string, verbose: boolean = true): Promise<any> {
    return this.rpcClient.getRawTransaction(txid, verbose);
  }


  /**
   * Build and broadcast a RETRY-CLAIM transaction
   * 
   * @param x New X coordinate (0-65534)
   * @param y New Y coordinate (0-65534)
   * @param deedInput The deed UTXO to spend (from original CLAIM)
   * @param changeAddress Optional change address (if not provided, will create one)
   * @param deedAddress Optional deed address (if not provided, will create one)
   * @param broadcast Whether to broadcast the transaction (default: true)
   * @returns Transaction result with txid and deed UTXO info
   */
  async buildRetryClaimTransaction(
    x: number,
    y: number,
    deedInput: { txid: string; vout: number; amount: number },
    changeAddress?: string,
    deedAddress?: string,
    broadcast: boolean = true
  ): Promise<ClaimTransactionResult> {
    // Build the OP_RETURN payload for RETRY-CLAIM
    const opReturnHex = buildRetryClaimOpReturnHex(x, y);

    // Get or create addresses
    if (!changeAddress) {
      changeAddress = await this.rpcClient.getNewAddress();
    }
    if (!deedAddress) {
      deedAddress = await this.rpcClient.getNewAddress();
    }

    // Lock all deed UTXOs except the one we're spending to prevent accidental selection as funding
    try {
      await this.walletManager.lockAllDeedUTXOsExcept({ txid: deedInput.txid, vout: deedInput.vout });
    } catch (error) {
      console.warn(`Warning: Failed to lock deed UTXOs: ${error instanceof Error ? error.message : 'unknown'}`);
      // Continue anyway - this is defensive programming, not critical to transaction creation
    }
    
    // Unlock the deed UTXO so we can spend it
    try {
      await this.rpcClient.lockUnspent(true, [{ txid: deedInput.txid, vout: deedInput.vout }]);
    } catch (error) {
      // If unlocking fails, warn but continue (might not be locked)
      console.warn(`Warning: Failed to unlock deed UTXO ${deedInput.txid}:${deedInput.vout}: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    
    // Unlock the specific deed UTXO so we can spend it
    try {
      await this.rpcClient.lockUnspent(true, [{ txid: deedInput.txid, vout: deedInput.vout }]);
    } catch (error) {
      // If unlocking fails, warn but continue (might not be locked)
      console.warn(`Warning: Failed to unlock deed UTXO ${deedInput.txid}:${deedInput.vout}: ${error instanceof Error ? error.message : 'unknown'}`);
    }

    // Build transaction with deed input and required outputs
    const inputs = [{ txid: deedInput.txid, vout: deedInput.vout }];
    const outputs = [
      { data: opReturnHex },
      { [deedAddress]: this.DEED_AMOUNT } // 600 sat deed
      // Change will be added by fundrawtransaction
    ];

    // Create initial raw transaction
    const rawTx = await this.rpcClient.createRawTransaction(inputs, outputs);

    // Use fundrawtransaction to calculate fee and add change
    const feeRate = this.feeRate * 0.00001; // Convert sat/vByte to BTC/kB
    const funded = await this.rpcClient.fundRawTransaction(rawTx, {
      add_inputs: true,      // Allow adding more inputs for fees
      changeAddress: changeAddress,
      feeRate: feeRate
    });

    // Decode the funded transaction to find the deed output position
    const decodedFunded = await this.rpcClient.decodeRawTransaction(funded.hex);

    // Sign transaction
    const signedResult = await this.rpcClient.signRawTransactionWithWallet(funded.hex);
    
    if (!signedResult.complete) {
      console.error(`RETRY-CLAIM signing failed. Deed input: ${deedInput.txid}:${deedInput.vout}, amount: ${deedInput.amount}`);
      throw new Error(`Failed to sign RETRY-CLAIM transaction - wallet may not control the deed UTXO`);
    }

    let txid: string;
    let deedVout: number;
    
    if (broadcast) {
      // CRITICAL SAFETY CHECK: Verify transaction inputs before broadcasting
      // For RETRY-CLAIM, we should have EXACTLY ONE deed input (the one we're intentionally spending)
      const decodedTx = await this.rpcClient.decodeRawTransaction(signedResult.hex);
      
      let deedInputCount = 0;
      const unexpectedDeedInputs: string[] = [];
      
      for (const input of decodedTx.vin) {
        try {
          const prevTx = await this.rpcClient.getRawTransaction(input.txid, true);
          const prevOutput = prevTx.vout[input.vout];
          
          // Check if this input is a deed UTXO (exactly 600 sats)
          if (prevOutput.value === this.DEED_AMOUNT) {
            deedInputCount++;
            
            // Verify this is the INTENDED deed input
            if (input.txid !== deedInput.txid || input.vout !== deedInput.vout) {
              unexpectedDeedInputs.push(`${input.txid}:${input.vout}`);
            }
          }
        } catch (error) {
          if (error instanceof Error && (error.message.includes('BRICK') || error.message.includes('CRITICAL'))) {
            throw error;
          }
          console.warn(`Warning: Could not verify input ${input.txid}:${input.vout}`);
        }
      }
      
      // CRITICAL: Ensure we have exactly one deed input and it's the intended one
      if (deedInputCount === 0) {
        throw new Error(
          `❌ CRITICAL: RETRY-CLAIM transaction has NO deed inputs! ` +
          `Expected to spend deed ${deedInput.txid}:${deedInput.vout}. Transaction NOT broadcasted.`
        );
      }
      
      if (deedInputCount > 1) {
        throw new Error(
          `❌ CRITICAL: RETRY-CLAIM transaction attempts to spend ${deedInputCount} deed UTXOs (600 sats each)! ` +
          `Expected to spend only ONE deed: ${deedInput.txid}:${deedInput.vout}. ` +
          `Unexpected deed inputs: ${unexpectedDeedInputs.join(', ')}. ` +
          `This would BRICK multiple plots! Transaction NOT broadcasted. ` +
          `Please check your wallet UTXOs and ensure only deed outputs are not selected as funding inputs.`
        );
      }
      
      if (unexpectedDeedInputs.length > 0) {
        throw new Error(
          `❌ CRITICAL: RETRY-CLAIM transaction spends wrong deed UTXO! ` +
          `Expected: ${deedInput.txid}:${deedInput.vout}, but found: ${unexpectedDeedInputs.join(', ')}. ` +
          `Transaction NOT broadcasted.`
        );
      }
      
      // Broadcast transaction
      txid = await this.rpcClient.sendRawTransaction(signedResult.hex);

      // Find the deed UTXO (fundrawtransaction can reorder outputs, so we can't assume vout 1)
      deedVout = -1;
      for (let i = 0; i < decodedFunded.vout.length; i++) {
        const output = decodedFunded.vout[i];
        if (output.value === this.DEED_AMOUNT) {
          deedVout = i;
          break;
        }
      }
      
      if (deedVout === -1) {
        throw new Error(`Could not find deed UTXO (${this.DEED_AMOUNT} BTC) in transaction ${txid}`);
      }
      
      const deedUTXO = `${txid}:${deedVout}`;

      // Lock the new deed UTXO to prevent accidental spending
      try {
        const lockResult = await this.rpcClient.lockUnspent(false, [{ txid, vout: deedVout }]);
        if (!lockResult) {
          throw new Error(`lockUnspent returned false`);
        }
        console.log(`Created RETRY-CLAIM transaction ${txid} with deed UTXO ${deedUTXO} (locked)`);
      } catch (error) {
        console.error(`❌ CRITICAL: Failed to lock deed UTXO ${deedUTXO}: ${error instanceof Error ? error.message : 'unknown'}`);
        console.error(`This deed may be accidentally spent by future transactions!`);
        throw new Error(`Failed to lock deed UTXO ${deedUTXO}: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    } else {
      // Calculate txid from hex without broadcasting
      const txBuffer = Buffer.from(signedResult.hex, 'hex');
      const crypto = require('crypto');
      const hash1 = crypto.createHash('sha256').update(txBuffer).digest();
      const hash2 = crypto.createHash('sha256').update(hash1).digest();
      txid = hash2.reverse().toString('hex');
      
      // Find the deed UTXO position
      deedVout = -1;
      for (let i = 0; i < decodedFunded.vout.length; i++) {
        const output = decodedFunded.vout[i];
        if (output.value === this.DEED_AMOUNT) {
          deedVout = i;
          break;
        }
      }
      
      if (deedVout === -1) {
        throw new Error(`Could not find deed UTXO (${this.DEED_AMOUNT} BTC) in transaction ${txid}`);
      }
      
      console.log(`Built RETRY-CLAIM transaction ${txid} (not broadcasted)`);
    }
    
    const deedUTXO = `${txid}:${deedVout}`;

    return {
      txid,
      deedUTXO,
      deedAddress,
      hex: signedResult.hex
    };
  }


  /**
   * Build an UPDATE transaction
   * Updates the image of an existing PLACED plot at the same coordinates
   */
  async buildUpdateTransaction(
    x: number,
    y: number,
    uri: string,
    bmpHex: string,
    deedInput: { txid: string; vout: number; amount: number },
    changeAddress?: string,
    deedAddress?: string,
    broadcast: boolean = true
  ): Promise<ClaimTransactionResult> {
    // Build OP_RETURN payload
    const opReturnHex = buildUpdateOpReturnHex(x, y, uri, bmpHex);

    // Get or create addresses
    if (!changeAddress) {
      changeAddress = await this.rpcClient.getNewAddress();
    }
    if (!deedAddress) {
      deedAddress = await this.rpcClient.getNewAddress();
    }

    // Lock all deed UTXOs except the one we're spending to prevent accidental selection as funding
    try {
      await this.walletManager.lockAllDeedUTXOsExcept({ txid: deedInput.txid, vout: deedInput.vout });
    } catch (error) {
      console.warn(`Warning: Failed to lock deed UTXOs: ${error instanceof Error ? error.message : 'unknown'}`);
      // Continue anyway - this is defensive programming, not critical to transaction creation
    }
    
    // Unlock the deed UTXO so we can spend it
    try {
      await this.rpcClient.lockUnspent(true, [{ txid: deedInput.txid, vout: deedInput.vout }]);
    } catch (error) {
      // If unlocking fails, warn but continue (might not be locked)
      console.warn(`Warning: Failed to unlock deed UTXO ${deedInput.txid}:${deedInput.vout}: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    
    // Unlock the specific deed UTXO so we can spend it
    try {
      await this.rpcClient.lockUnspent(true, [{ txid: deedInput.txid, vout: deedInput.vout }]);
    } catch (error) {
      // If unlocking fails, warn but continue (might not be locked)
      console.warn(`Warning: Failed to unlock deed UTXO ${deedInput.txid}:${deedInput.vout}: ${error instanceof Error ? error.message : 'unknown'}`);
    }

    // Build transaction with deed input and required outputs
    const inputs = [{ txid: deedInput.txid, vout: deedInput.vout }];
    const outputs = [
      { data: opReturnHex },
      { [deedAddress]: this.DEED_AMOUNT } // 600 sat deed
      // Change will be added by fundrawtransaction
    ];

    // Create initial raw transaction
    const rawTx = await this.rpcClient.createRawTransaction(inputs, outputs);

    // Use fundrawtransaction to calculate fee and add change
    const feeRate = this.feeRate * 0.00001; // Convert sat/vByte to BTC/kB
    const funded = await this.rpcClient.fundRawTransaction(rawTx, {
      add_inputs: true,      // Allow adding more inputs for fees
      changeAddress: changeAddress,
      feeRate: feeRate
    });

    // Decode the funded transaction to find the deed output position
    const decodedFunded = await this.rpcClient.decodeRawTransaction(funded.hex);

    // Sign transaction
    const signedResult = await this.rpcClient.signRawTransactionWithWallet(funded.hex);
    
    if (!signedResult.complete) {
      console.error(`UPDATE signing failed. Deed input: ${deedInput.txid}:${deedInput.vout}, amount: ${deedInput.amount}`);
      throw new Error(`Failed to sign UPDATE transaction - wallet may not control the deed UTXO`);
    }

    let txid: string;
    let deedVout: number;
    
    if (broadcast) {
      // CRITICAL SAFETY CHECK: Verify transaction inputs before broadcasting
      // For UPDATE, we should have EXACTLY ONE deed input (the one we're intentionally spending)
      const decodedTx = await this.rpcClient.decodeRawTransaction(signedResult.hex);
      
      let deedInputCount = 0;
      const unexpectedDeedInputs: string[] = [];
      
      for (const input of decodedTx.vin) {
        try {
          const prevTx = await this.rpcClient.getRawTransaction(input.txid, true);
          const prevOutput = prevTx.vout[input.vout];
          
          // Check if this input is a deed UTXO (exactly 600 sats)
          if (prevOutput.value === this.DEED_AMOUNT) {
            deedInputCount++;
            
            // Verify this is the INTENDED deed input
            if (input.txid !== deedInput.txid || input.vout !== deedInput.vout) {
              unexpectedDeedInputs.push(`${input.txid}:${input.vout}`);
            }
          }
        } catch (error) {
          if (error instanceof Error && (error.message.includes('BRICK') || error.message.includes('CRITICAL'))) {
            throw error;
          }
          console.warn(`Warning: Could not verify input ${input.txid}:${input.vout}`);
        }
      }
      
      // CRITICAL: Ensure we have exactly one deed input and it's the intended one
      if (deedInputCount === 0) {
        throw new Error(
          `❌ CRITICAL: UPDATE transaction has NO deed inputs! ` +
          `Expected to spend deed ${deedInput.txid}:${deedInput.vout}. Transaction NOT broadcasted.`
        );
      }
      
      if (deedInputCount > 1) {
        throw new Error(
          `❌ CRITICAL: UPDATE transaction attempts to spend ${deedInputCount} deed UTXOs (600 sats each)! ` +
          `Expected to spend only ONE deed: ${deedInput.txid}:${deedInput.vout}. ` +
          `Unexpected deed inputs: ${unexpectedDeedInputs.join(', ')}. ` +
          `This would BRICK multiple plots! Transaction NOT broadcasted. ` +
          `Please check your wallet UTXOs and ensure only deed outputs are not selected as funding inputs.`
        );
      }
      
      if (unexpectedDeedInputs.length > 0) {
        throw new Error(
          `❌ CRITICAL: UPDATE transaction spends wrong deed UTXO! ` +
          `Expected: ${deedInput.txid}:${deedInput.vout}, but found: ${unexpectedDeedInputs.join(', ')}. ` +
          `Transaction NOT broadcasted.`
        );
      }
      
      // Broadcast transaction
      txid = await this.rpcClient.sendRawTransaction(signedResult.hex);

      // Find the deed UTXO (fundrawtransaction can reorder outputs, so we can't assume vout 1)
      deedVout = -1;
      for (let i = 0; i < decodedFunded.vout.length; i++) {
        const output = decodedFunded.vout[i];
        if (output.value === this.DEED_AMOUNT) {
          deedVout = i;
          break;
        }
      }
      
      if (deedVout === -1) {
        throw new Error(`Could not find deed UTXO (${this.DEED_AMOUNT} BTC) in transaction ${txid}`);
      }
      
      const deedUTXO = `${txid}:${deedVout}`;

      // Lock the new deed UTXO to prevent accidental spending
      try {
        const lockResult = await this.rpcClient.lockUnspent(false, [{ txid, vout: deedVout }]);
        if (!lockResult) {
          throw new Error(`lockUnspent returned false`);
        }
        console.log(`Created UPDATE transaction ${txid} with deed UTXO ${deedUTXO} (locked)`);
      } catch (error) {
        console.error(`❌ CRITICAL: Failed to lock deed UTXO ${deedUTXO}: ${error instanceof Error ? error.message : 'unknown'}`);
        console.error(`This deed may be accidentally spent by future transactions!`);
        throw new Error(`Failed to lock deed UTXO ${deedUTXO}: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    } else {
      // Calculate txid from hex without broadcasting
      const txBuffer = Buffer.from(signedResult.hex, 'hex');
      const crypto = require('crypto');
      const hash1 = crypto.createHash('sha256').update(txBuffer).digest();
      const hash2 = crypto.createHash('sha256').update(hash1).digest();
      txid = hash2.reverse().toString('hex');
      
      // Find the deed UTXO position
      deedVout = -1;
      for (let i = 0; i < decodedFunded.vout.length; i++) {
        const output = decodedFunded.vout[i];
        if (output.value === this.DEED_AMOUNT) {
          deedVout = i;
          break;
        }
      }
      
      if (deedVout === -1) {
        throw new Error(`Could not find deed UTXO (${this.DEED_AMOUNT} BTC) in transaction ${txid}`);
      }
      
      console.log(`Built UPDATE transaction ${txid} (not broadcasted)`);
    }
    
    const deedUTXO = `${txid}:${deedVout}`;

    return {
      txid,
      deedUTXO,
      deedAddress,
      hex: signedResult.hex
    };
  }

  /**
   * Build an UPDATE transaction with wrong dimensions (for testing)
   * This creates a valid transaction but with coordinates/dimensions that don't match the original
   */
  async buildUpdateWithWrongDimensions(
    x: number,
    y: number,
    uri: string,
    bmpHex: string,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<ClaimTransactionResult> {
    // Just use the regular buildUpdateTransaction with different coordinates
    return this.buildUpdateTransaction(x, y, uri, bmpHex, deedInput);
  }

  /**
   * Build a TRANSFER transaction
   * Transfers ownership of a plot without changing its image or coordinates
   * No OP_RETURN required - just deed spend and new deed output
   */
  async buildTransferTransaction(
    deedInput: { txid: string; vout: number; amount: number },
    changeAddress?: string,
    deedAddress?: string
  ): Promise<ClaimTransactionResult> {
    // Get or create addresses
    if (!changeAddress) {
      changeAddress = await this.rpcClient.getNewAddress();
    }
    if (!deedAddress) {
      deedAddress = await this.rpcClient.getNewAddress();
    }

    // Lock all deed UTXOs except the one we're spending to prevent accidental selection as funding
    try {
      await this.walletManager.lockAllDeedUTXOsExcept({ txid: deedInput.txid, vout: deedInput.vout });
    } catch (error) {
      console.warn(`Warning: Failed to lock deed UTXOs: ${error instanceof Error ? error.message : 'unknown'}`);
      // Continue anyway - this is defensive programming, not critical to transaction creation
    }
    
    // Unlock the deed UTXO so we can spend it
    try {
      await this.rpcClient.lockUnspent(true, [{ txid: deedInput.txid, vout: deedInput.vout }]);
    } catch (error) {
      // If unlocking fails, warn but continue (might not be locked)
      console.warn(`Warning: Failed to unlock deed UTXO ${deedInput.txid}:${deedInput.vout}: ${error instanceof Error ? error.message : 'unknown'}`);
    }
    
    // Unlock the specific deed UTXO so we can spend it
    try {
      await this.rpcClient.lockUnspent(true, [{ txid: deedInput.txid, vout: deedInput.vout }]);
    } catch (error) {
      // If unlocking fails, warn but continue (might not be locked)
      console.warn(`Warning: Failed to unlock deed UTXO ${deedInput.txid}:${deedInput.vout}: ${error instanceof Error ? error.message : 'unknown'}`);
    }

    // Build transaction with deed input and required outputs
    const inputs = [{ txid: deedInput.txid, vout: deedInput.vout }];
    const outputs = [
      { [deedAddress]: this.DEED_AMOUNT } // 600 sat deed
      // Change will be added by fundrawtransaction
    ];

    // Create initial raw transaction
    const rawTx = await this.rpcClient.createRawTransaction(inputs, outputs);

    // Use fundrawtransaction to calculate fee and add change
    const feeRate = this.feeRate * 0.00001; // Convert sat/vByte to BTC/kB
    const funded = await this.rpcClient.fundRawTransaction(rawTx, {
      add_inputs: true,      // Allow adding more inputs for fees
      changeAddress: changeAddress,
      feeRate: feeRate
    });

    // Decode the funded transaction to find the deed output position
    const decodedFunded = await this.rpcClient.decodeRawTransaction(funded.hex);

    // Sign transaction
    const signedResult = await this.rpcClient.signRawTransactionWithWallet(funded.hex);
    
    if (!signedResult.complete) {
      console.error(`TRANSFER signing failed. Deed input: ${deedInput.txid}:${deedInput.vout}, amount: ${deedInput.amount}`);
      throw new Error(`Failed to sign TRANSFER transaction - wallet may not control the deed UTXO`);
    }

    // CRITICAL SAFETY CHECK: Verify transaction inputs before broadcasting
    // For TRANSFER, we should have EXACTLY ONE deed input (the one we're intentionally spending)
    const decodedTx = await this.rpcClient.decodeRawTransaction(signedResult.hex);
    
    let deedInputCount = 0;
    const unexpectedDeedInputs: string[] = [];
    
    for (const input of decodedTx.vin) {
      try {
        const prevTx = await this.rpcClient.getRawTransaction(input.txid, true);
        const prevOutput = prevTx.vout[input.vout];
        
        // Check if this input is a deed UTXO (exactly 600 sats)
        if (prevOutput.value === this.DEED_AMOUNT) {
          deedInputCount++;
          
          // Verify this is the INTENDED deed input
          if (input.txid !== deedInput.txid || input.vout !== deedInput.vout) {
            unexpectedDeedInputs.push(`${input.txid}:${input.vout}`);
          }
        }
      } catch (error) {
        if (error instanceof Error && (error.message.includes('BRICK') || error.message.includes('CRITICAL'))) {
          throw error;
        }
        console.warn(`Warning: Could not verify input ${input.txid}:${input.vout}`);
      }
    }
    
    // CRITICAL: Ensure we have exactly one deed input and it's the intended one
    if (deedInputCount === 0) {
      throw new Error(
        `❌ CRITICAL: TRANSFER transaction has NO deed inputs! ` +
        `Expected to spend deed ${deedInput.txid}:${deedInput.vout}. Transaction NOT broadcasted.`
      );
    }
    
    if (deedInputCount > 1) {
      throw new Error(
        `❌ CRITICAL: TRANSFER transaction attempts to spend ${deedInputCount} deed UTXOs (600 sats each)! ` +
        `Expected to spend only ONE deed: ${deedInput.txid}:${deedInput.vout}. ` +
        `Unexpected deed inputs: ${unexpectedDeedInputs.join(', ')}. ` +
        `This would BRICK multiple plots! Transaction NOT broadcasted. ` +
        `Please check your wallet UTXOs and ensure only deed outputs are not selected as funding inputs.`
      );
    }
    
    if (unexpectedDeedInputs.length > 0) {
      throw new Error(
        `❌ CRITICAL: TRANSFER transaction spends wrong deed UTXO! ` +
        `Expected: ${deedInput.txid}:${deedInput.vout}, but found: ${unexpectedDeedInputs.join(', ')}. ` +
        `Transaction NOT broadcasted.`
      );
    }

    // Broadcast transaction
    const txid = await this.rpcClient.sendRawTransaction(signedResult.hex);

    // Find the deed UTXO (fundrawtransaction can reorder outputs)
    // Use decodedFunded (from the funded transaction) not decodedTx
    let deedVout = -1;
    for (let i = 0; i < decodedFunded.vout.length; i++) {
      const output = decodedFunded.vout[i];
      if (output.value === this.DEED_AMOUNT) {
        deedVout = i;
        break;
      }
    }
    
    if (deedVout === -1) {
      throw new Error(`Could not find deed UTXO (${this.DEED_AMOUNT} BTC) in transaction ${txid}`);
    }
    
    const deedUTXO = `${txid}:${deedVout}`;

    // Lock the new deed UTXO to prevent accidental spending
    try {
      const lockResult = await this.rpcClient.lockUnspent(false, [{ txid, vout: deedVout }]);
      if (!lockResult) {
        throw new Error(`lockUnspent returned false`);
      }
      console.log(`Created TRANSFER transaction ${txid} with deed UTXO ${deedUTXO} (locked)`);
    } catch (error) {
      console.error(`❌ CRITICAL: Failed to lock deed UTXO ${deedUTXO}: ${error instanceof Error ? error.message : 'unknown'}`);
      console.error(`This deed may be accidentally spent by future transactions!`);
      throw new Error(`Failed to lock deed UTXO ${deedUTXO}: ${error instanceof Error ? error.message : 'unknown'}`);
    }

    return {
      txid,
      deedUTXO,
      deedAddress,
      hex: signedResult.hex
    };
  }


}

/**
 * Builds a RETRY-CLAIM transaction OP_RETURN payload as hex
 * Format: [0x13, 0x37] | [0x01] | [0x02] | x[2] | y[2]
 * 
 * @param x New X coordinate (0-65534)
 * @param y New Y coordinate (0-65534)
 * @returns Hex string of OP_RETURN payload
 */
function buildRetryClaimOpReturnHex(x: number, y: number): string {
  // Magic bytes
  const magic = Buffer.from([0x13, 0x37]);
  
  // Version
  const version = Buffer.from([0x01]);
  
  // Transaction type (RETRY-CLAIM = 0x02)
  const txType = Buffer.from([0x02]);
  
  // Coordinates (little-endian 16-bit)
  const xBuffer = Buffer.allocUnsafe(2);
  xBuffer.writeUInt16LE(x, 0);
  
  const yBuffer = Buffer.allocUnsafe(2);
  yBuffer.writeUInt16LE(y, 0);
  
  // Concatenate all parts (no URI or BMP for RETRY-CLAIM)
  const payload = Buffer.concat([
    magic,
    version,
    txType,
    xBuffer,
    yBuffer
  ]);
  
  return payload.toString('hex');
}

/**
 * Build UPDATE OP_RETURN payload
 * Format: [0x13 0x37] | [0x01] | [0x03] | x0[2] | y0[2] | URI | BMP
 */
function buildUpdateOpReturnHex(x: number, y: number, uri: string, bmpHex: string): string {
  // Import CBOR encoder
  const { encode: cborEncode } = require('cbor-x');
  
  // Magic bytes
  const magic = Buffer.from([0x13, 0x37]);
  
  // Version
  const version = Buffer.from([0x01]);
  
  // Transaction type: UPDATE = 0x03
  const txType = Buffer.from([0x03]);
  
  // Coordinates (little-endian)
  const xBuffer = Buffer.allocUnsafe(2);
  xBuffer.writeUInt16LE(x, 0);
  
  const yBuffer = Buffer.allocUnsafe(2);
  yBuffer.writeUInt16LE(y, 0);
  
  // URI (CBOR encoded)
  const uriBuffer = cborEncode(uri);
  
  // Concatenate all parts
  const payload = Buffer.concat([
    magic,
    version,
    txType,
    xBuffer,
    yBuffer,
    uriBuffer,
    Buffer.from(bmpHex, 'hex')
  ]);
  
  return payload.toString('hex');
}
