/**
 * Invalid Transaction Builder - TEST HELPERS ONLY
 * 
 * These functions manually craft invalid UBB transactions "by hand" to test
 * how the indexer handles malicious or malformed transactions that somehow
 * get on-chain.
 * 
 * CRITICAL: These should NEVER be used in production code.
 * Production code paths must NEVER create invalid transactions.
 * 
 * Purpose: Test that the indexer correctly rejects/handles:
 * - Invalid BMP formats
 * - Wrong deed amounts
 * - Missing deed outputs
 * - Malformed CBOR
 * - Protocol violations
 */

import { TransactionBuilder } from '../../src/bitcoin/transaction-builder';
import { WalletManager } from '../../src/bitcoin/wallet-manager';
import { BitcoinRpcClient } from '../../src/bitcoin/bitcoin-rpc-client';
import { encode as cborEncode } from 'cbor-x';

export class InvalidTransactionBuilder {
  constructor(
    private txBuilder: TransactionBuilder,
    private walletManager: WalletManager,
    private rpcClient: BitcoinRpcClient
  ) {}

  /**
   * Build CLAIM with invalid deed amount (not 600 sats)
   * Manually constructs transaction to bypass production validation
   */
  async buildClaimWithInvalidDeedAmount(
    x: number,
    y: number,
    uri: string,
    bmpHex: string,
    deedAmount: number // e.g., 599 or 601 sats
  ): Promise<string> {
    // Manually construct OP_RETURN with valid UBB data
    const opReturnData = this.buildValidClaimOpReturn(x, y, uri, bmpHex);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const deedAmountBTC = deedAmount / 100000000;
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - deedAmountBTC - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: deedAmountBTC }, // Wrong amount!
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with NO deed output
   * Only has OP_RETURN and change
   */
  async buildClaimWithoutDeedOutput(
    x: number,
    y: number,
    uri: string,
    bmpHex: string
  ): Promise<string> {
    const opReturnData = this.buildValidClaimOpReturn(x, y, uri, bmpHex);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
      // No deed output!
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with unspendable deed (sends 600 sats to OP_RETURN)
   */
  async buildClaimWithUnspendableDeed(
    x: number,
    y: number,
    uri: string,
    bmpHex: string
  ): Promise<string> {
    const opReturnData = this.buildValidClaimOpReturn(x, y, uri, bmpHex);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();

    // Create a second OP_RETURN with 600 sats (unspendable!)
    const dummyData = Buffer.from('unspendable');

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { data: dummyData.toString('hex') }, // Unspendable! But Bitcoin Core will reject this...
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    // Note: Bitcoin Core won't allow multiple OP_RETURNs in standard transactions
    // So we just don't create a deed output at all - same effect as unspendable
    const outputsAlt: Record<string, number | string>[] = [
      { data: opReturnData.toString('hex') },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
      // No deed output = unspendable!
    ];
    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputsAlt);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with multiple 600-sat outputs (ambiguous deed)
   */
  async buildClaimWithMultiple600SatOutputs(
    x: number,
    y: number,
    uri: string,
    bmpHex: string
  ): Promise<string> {
    const opReturnData = this.buildValidClaimOpReturn(x, y, uri, bmpHex);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress1 = await this.rpcClient.getNewAddress();
    const deedAddress2 = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress1]: 0.000006 }, // First 600 sats
      { [deedAddress2]: 0.000006 }, // Second 600 sats - ambiguous!
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with malformed CBOR (non-text major type)
   * Manually constructs OP_RETURN with wrong CBOR encoding
   */
  async buildClaimWithMalformedCBOR(
    x: number,
    y: number,
    bmpHex: string,
    majorType: number // e.g., 0 for unsigned int, 2 for byte string
  ): Promise<string> {
    // Manually construct OP_RETURN with malformed CBOR
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x01]); // CLAIM
    
    // Coordinates as proper unsigned integers
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    // URI with WRONG CBOR major type
    let uriCbor: Buffer;
    if (majorType === 0) {
      // Major type 0: unsigned integer
      uriCbor = Buffer.from(cborEncode(123)); // number instead of text
    } else if (majorType === 2) {
      // Major type 2: byte string
      uriCbor = Buffer.from(cborEncode(Buffer.from(''))); // bytes instead of text
    } else if (majorType === 7) {
      // Major type 7: simple value (null)
      uriCbor = Buffer.from(cborEncode(null));
    } else {
      // Default to text (valid)
      uriCbor = Buffer.from(cborEncode(''));
    }
    
    // BMP as proper byte string
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    const bmpCbor = Buffer.from(cborEncode(bmpBuffer));
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpCbor]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM without validation - allows any BMP data on-chain
   * This bypasses all BMP validation to test indexer rejection
   */
  async buildUnvalidatedClaimTransaction(
    x: number,
    y: number,
    uri: string,
    bmpHex: string,
    customFee?: number
  ): Promise<string> {
    // Lock all existing deed UTXOs to prevent them being used as funding
    await this.walletManager.lockAllDeedUTXOsExcept();
    
    // Build OP_RETURN without validation
    const opReturnData = this.buildValidClaimOpReturn(x, y, uri, bmpHex);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = customFee || 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build RETRY-CLAIM without deed output (will BRICK the plot)
   */
  async buildRetryClaimWithoutDeedOutput(
    x: number,
    y: number,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    const opReturnData = this.buildValidRetryClaimOpReturn(x, y);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00001;
    const changeAmount = totalInput - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
      // No deed output! Will brick the plot
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build RETRY-CLAIM transaction
   */
  async buildRetryTransaction(
    x: number,
    y: number,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    // Lock all deed UTXOs except the one we're spending
    await this.walletManager.lockAllDeedUTXOsExcept({ txid: deedInput.txid, vout: deedInput.vout });
    
    const result = await this.txBuilder.buildRetryClaimTransaction(x, y, deedInput);
    return result.txid;
  }

  /**
   * Build UPDATE transaction
   */
  async buildUpdateTransaction(
    x: number,
    y: number,
    uri: string,
    bmpHex: string,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    // Lock all deed UTXOs except the one we're spending
    await this.walletManager.lockAllDeedUTXOsExcept({ txid: deedInput.txid, vout: deedInput.vout });
    
    const result = await this.txBuilder.buildUpdateTransaction(x, y, uri, bmpHex, deedInput);
    return result.txid;
  }

  /**
   * Build TRANSFER without deed output (will BRICK the plot)
   */
  async buildTransferWithoutDeedOutput(
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    // Lock all deed UTXOs except the one we're spending
    await this.walletManager.lockAllDeedUTXOsExcept({ txid: deedInput.txid, vout: deedInput.vout });
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00001;
    const changeAmount = totalInput - fee;
    
    const outputs = [
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
      // No deed output! Will brick the plot
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build TRANSFER with wrong deed amount (will BRICK the plot)
   */
  async buildTransferWithWrongDeedAmount(
    deedInput: { txid: string; vout: number; amount: number },
    wrongDeedAmount: number // e.g., 599 or 601
  ): Promise<string> {
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const wrongDeedAmountBTC = wrongDeedAmount / 100000000;
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00001;
    const changeAmount = totalInput - wrongDeedAmountBTC - fee;
    
    const outputs = [
      { [deedAddress]: wrongDeedAmountBTC }, // Wrong amount!
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build top-down BMP (negative height in header)
   * Used to test that indexer handles both orientations
   */
  buildTopDownBMP(width: number, height: number): Buffer {
    const headerSize = 54;
    const bytesPerPixel = 3;
    const stride = Math.ceil((width * bytesPerPixel) / 4) * 4;
    const pixelDataSize = stride * height;
    const fileSize = headerSize + pixelDataSize;

    const buffer = Buffer.alloc(fileSize);
    
    buffer.write('BM', 0);
    buffer.writeUInt32LE(fileSize, 2);
    buffer.writeUInt32LE(0, 6);
    buffer.writeUInt32LE(headerSize, 10);
    buffer.writeUInt32LE(40, 14);
    buffer.writeInt32LE(width, 18);
    buffer.writeInt32LE(-height, 22); // Negative height = top-down!
    buffer.writeUInt16LE(1, 26);
    buffer.writeUInt16LE(24, 28);
    buffer.writeUInt32LE(0, 30);
    buffer.writeUInt32LE(pixelDataSize, 34);
    buffer.writeInt32LE(0, 38);
    buffer.writeInt32LE(0, 42);
    buffer.writeUInt32LE(0, 46);
    buffer.writeUInt32LE(0, 50);

    return buffer;
  }

  // ============ PRIVATE HELPERS ============

  /**
   * Manually build valid CLAIM OP_RETURN data (no validation)
   * This is a low-level helper that just encodes the data structure
   */
  private buildValidClaimOpReturn(x: number, y: number, uri: string, bmpHex: string): Buffer {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x01]); // CLAIM
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    const uriCbor = Buffer.from(cborEncode(uri));
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    // BMP data is raw bytes, NOT CBOR encoded
    
    return Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpBuffer]);
  }

  /**
   * Manually build valid RETRY-CLAIM OP_RETURN data
   */
  private buildValidRetryClaimOpReturn(x: number, y: number): Buffer {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x02]); // RETRY-CLAIM
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    return Buffer.concat([magic, version, type, xBuf, yBuf]);
  }

  /**
   * Manually build valid UPDATE OP_RETURN data
   */
  private buildValidUpdateOpReturn(x: number, y: number, uri: string, bmpHex: string): Buffer {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x03]); // UPDATE
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    const uriCbor = Buffer.from(cborEncode(uri));
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    
    return Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpBuffer]);
  }

  // ============ NEW METHODS FOR COMPREHENSIVE TESTING ============

  /**
   * Build CLAIM with multiple UBB OP_RETURNs (should be ignored, transfer-only)
   * Workaround for Core v30 RPC limitation: manually construct transaction with multiple OP_RETURNs
   */
  async buildClaimWithMultipleUBBOpReturns(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    bmpHex: string
  ): Promise<string> {
    const opReturn1 = this.buildValidClaimOpReturn(x1, y1, '', bmpHex);
    const opReturn2 = this.buildValidClaimOpReturn(x2, y2, '', bmpHex);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const fee = 0.00002;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    // First create a transaction with ONE OP_RETURN to get the structure
    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    const outputs = [
      { data: opReturn1.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const baseTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const decoded = await this.rpcClient.decodeRawTransaction(baseTx);
    
    // Now manually insert the second OP_RETURN by constructing the raw hex
    const modifiedHex = await this.insertAdditionalOpReturn(baseTx, opReturn2.toString('hex'), 1);
    
    const signedHex = await this.txBuilder.signTransaction(modifiedHex);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Insert an additional OP_RETURN output into a raw transaction hex
   * This is a workaround for Core v30 RPC not supporting multiple data outputs
   */
  private async insertAdditionalOpReturn(rawTxHex: string, opReturnDataHex: string, insertAtIndex: number): Promise<string> {
    const txBuffer = Buffer.from(rawTxHex, 'hex');
    
    // Bitcoin transaction structure:
    // version (4 bytes) | input count (varint) | inputs | output count (varint) | outputs | locktime (4 bytes)
    
    let offset = 0;
    
    // Read version
    const version = txBuffer.readUInt32LE(offset);
    offset += 4;
    
    // Read input count (varint)
    const [inputCount, inputCountBytes] = this.readVarInt(txBuffer, offset);
    offset += inputCountBytes;
    
    // Skip inputs (we need to parse them to find where outputs start)
    for (let i = 0; i < inputCount; i++) {
      // txid (32 bytes)
      offset += 32;
      // vout (4 bytes)
      offset += 4;
      // scriptSig length (varint)
      const [scriptSigLen, scriptSigLenBytes] = this.readVarInt(txBuffer, offset);
      offset += scriptSigLenBytes;
      // scriptSig
      offset += scriptSigLen;
      // sequence (4 bytes)
      offset += 4;
    }
    
    // Read output count
    const outputCountOffset = offset;
    const [outputCount, outputCountBytes] = this.readVarInt(txBuffer, offset);
    offset += outputCountBytes;
    
    // Parse existing outputs
    const outputs: Buffer[] = [];
    for (let i = 0; i < outputCount; i++) {
      const outputStart = offset;
      // value (8 bytes)
      offset += 8;
      // scriptPubKey length (varint)
      const [scriptLen, scriptLenBytes] = this.readVarInt(txBuffer, offset);
      offset += scriptLenBytes;
      // scriptPubKey
      offset += scriptLen;
      outputs.push(txBuffer.subarray(outputStart, offset));
    }
    
    // Create the new OP_RETURN output
    const opReturnData = Buffer.from(opReturnDataHex, 'hex');
    const opReturnScript = this.buildOpReturnScript(opReturnData);
    
    const newOutput = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]), // 0 satoshis
      this.encodeVarInt(opReturnScript.length),
      opReturnScript
    ]);
    
    // Insert the new output
    outputs.splice(insertAtIndex, 0, newOutput);
    
    // Rebuild the transaction
    const beforeOutputs = txBuffer.subarray(0, outputCountOffset);
    const afterOutputs = txBuffer.subarray(offset);
    
    const newTx = Buffer.concat([
      beforeOutputs,
      this.encodeVarInt(outputs.length),
      ...outputs,
      afterOutputs
    ]);
    
    return newTx.toString('hex');
  }

  /**
   * Read a Bitcoin varint from a buffer
   * Returns [value, bytesRead]
   */
  private readVarInt(buffer: Buffer, offset: number): [number, number] {
    const first = buffer.readUInt8(offset);
    if (first < 0xfd) {
      return [first, 1];
    } else if (first === 0xfd) {
      return [buffer.readUInt16LE(offset + 1), 3];
    } else if (first === 0xfe) {
      return [buffer.readUInt32LE(offset + 1), 5];
    } else {
      // 0xff - 64-bit, but we'll just read the lower 32 bits
      return [buffer.readUInt32LE(offset + 1), 9];
    }
  }

  /**
   * Build an OP_RETURN scriptPubKey with proper push opcodes
   */
  private buildOpReturnScript(data: Buffer): Buffer {
    const parts: Buffer[] = [Buffer.from([0x6a])]; // OP_RETURN
    
    // Add push opcode(s) for the data
    if (data.length <= 75) {
      // Direct push (OP_PUSHBYTES_N)
      parts.push(Buffer.from([data.length]));
      parts.push(data);
    } else if (data.length <= 0xff) {
      // OP_PUSHDATA1
      parts.push(Buffer.from([0x4c, data.length]));
      parts.push(data);
    } else if (data.length <= 0xffff) {
      // OP_PUSHDATA2
      const lenBuf = Buffer.allocUnsafe(2);
      lenBuf.writeUInt16LE(data.length, 0);
      parts.push(Buffer.from([0x4d]));
      parts.push(lenBuf);
      parts.push(data);
    } else {
      // OP_PUSHDATA4
      const lenBuf = Buffer.allocUnsafe(4);
      lenBuf.writeUInt32LE(data.length, 0);
      parts.push(Buffer.from([0x4e]));
      parts.push(lenBuf);
      parts.push(data);
    }
    
    return Buffer.concat(parts);
  }

  /**
   * Encode a number as a Bitcoin varint
   */
  private encodeVarInt(n: number): Buffer {
    if (n < 0xfd) {
      return Buffer.from([n]);
    } else if (n <= 0xffff) {
      const buf = Buffer.allocUnsafe(3);
      buf.writeUInt8(0xfd, 0);
      buf.writeUInt16LE(n, 1);
      return buf;
    } else if (n <= 0xffffffff) {
      const buf = Buffer.allocUnsafe(5);
      buf.writeUInt8(0xfe, 0);
      buf.writeUInt32LE(n, 1);
      return buf;
    } else {
      const buf = Buffer.allocUnsafe(9);
      buf.writeUInt8(0xff, 0);
      // Note: JavaScript numbers can't safely represent uint64, but we shouldn't need this
      buf.writeUInt32LE(n & 0xffffffff, 1);
      buf.writeUInt32LE(Math.floor(n / 0x100000000), 5);
      return buf;
    }
  }

  /**
   * Build UPDATE with multiple UBB OP_RETURNs (should be ignored, transfer-only)
   * Workaround for Core v30 RPC limitation: manually construct transaction with multiple OP_RETURNs
   */
  async buildUpdateWithMultipleUBBOpReturns(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    bmpHex: string,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    const opReturn1 = this.buildValidUpdateOpReturn(x1, y1, 'https://first.com', bmpHex);
    const opReturn2 = this.buildValidUpdateOpReturn(x2, y2, 'https://second.com', bmpHex);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00002;
    const changeAmount = totalInput - 0.000006 - fee;
    
    // Create base transaction with one OP_RETURN
    const outputs = [
      { data: opReturn1.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const baseTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    
    // Manually insert second OP_RETURN
    const modifiedHex = await this.insertAdditionalOpReturn(baseTx, opReturn2.toString('hex'), 1);
    
    const signedHex = await this.txBuilder.signTransaction(modifiedHex);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with non-UBB OP_RETURN (should not affect UBB validation)
   * Uses bitcore-lib to manually construct transaction with multiple OP_RETURNs
   */
  async buildClaimWithNonUBBOpReturn(
    x: number,
    y: number,
    uri: string,
    bmpHex: string
  ): Promise<string> {
    const bitcore = require('bitcore-lib');
    
    const ubbOpReturn = this.buildValidClaimOpReturn(x, y, uri, bmpHex);
    const nonUbbOpReturn = Buffer.from('This is not a UBB transaction');
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();
    
    const fee = 0.00002;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    // Get the raw transaction for the input
    const inputTx = await this.rpcClient.getRawTransaction(fundingUTXO.txid, true);
    
    // Create transaction using bitcore
    const tx = new bitcore.Transaction()
      .from({
        txId: fundingUTXO.txid,
        outputIndex: fundingUTXO.vout,
        script: inputTx.vout[fundingUTXO.vout].scriptPubKey.hex,
        satoshis: Math.round(fundingUTXO.amount * 100000000)
      });
    
    // Add first OP_RETURN (UBB)
    const ubbScript = bitcore.Script.buildDataOut(ubbOpReturn);
    tx.addOutput(new bitcore.Transaction.Output({
      script: ubbScript,
      satoshis: 0
    }));
    
    // Add second OP_RETURN (non-UBB)
    const nonUbbScript = bitcore.Script.buildDataOut(nonUbbOpReturn);
    tx.addOutput(new bitcore.Transaction.Output({
      script: nonUbbScript,
      satoshis: 0
    }));
    
    // Add deed output
    tx.to(deedAddress, 600);
    
    // Add change output
    tx.to(changeAddress, Math.round(changeAmount * 100000000));
    
    // Get the unsigned hex
    const unsignedHex = tx.uncheckedSerialize();
    
    // Sign using the wallet (which has the keys)
    const signedTx = await this.rpcClient.signRawTransactionWithWallet(unsignedHex);
    
    if (!signedTx.complete) {
      throw new Error('Failed to sign transaction with multiple OP_RETURNs');
    }
    
    // Broadcast
    return await this.txBuilder.broadcastTransaction(signedTx.hex);
  }

  /**
   * Build transaction with wrong magic bytes
   */
  async buildClaimWithWrongMagic(
    x: number,
    y: number,
    bmpHex: string
  ): Promise<string> {
    const magic = Buffer.from([0x12, 0x34]); // Wrong magic!
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x01]);
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    const uriCbor = Buffer.from(cborEncode(''));
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpBuffer]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build UPDATE with wrong magic (for testing deed transfer)
   */
  async buildUpdateWithWrongMagic(
    x: number,
    y: number,
    bmpHex: string,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    const magic = Buffer.from([0x12, 0x34]); // Wrong magic!
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x03]); // UPDATE
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    const uriCbor = Buffer.from(cborEncode(''));
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpBuffer]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00001;
    const changeAmount = totalInput - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build UPDATE with wrong version
   */
  async buildUpdateWithWrongVersion(
    x: number,
    y: number,
    bmpHex: string,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x02]); // Wrong version!
    const type = Buffer.from([0x03]); // UPDATE
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    const uriCbor = Buffer.from(cborEncode(''));
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpBuffer]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00001;
    const changeAmount = totalInput - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build UPDATE with unknown type
   */
  async buildUpdateWithUnknownType(
    x: number,
    y: number,
    bmpHex: string,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x99]); // Unknown type!
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    const uriCbor = Buffer.from(cborEncode(''));
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpBuffer]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00001;
    const changeAmount = totalInput - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with empty URI (CBOR 0x60)
   */
  async buildClaimWithEmptyURI(
    x: number,
    y: number,
    bmpHex: string
  ): Promise<string> {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x01]);
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    const uriCbor = Buffer.from([0x60]); // Empty text string
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpBuffer]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build UPDATE with empty URI
   */
  async buildUpdateWithEmptyURI(
    x: number,
    y: number,
    bmpHex: string,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x03]); // UPDATE
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    const uriCbor = Buffer.from([0x60]); // Empty text string
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpBuffer]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00005; // Higher fee for large OP_RETURN
    const changeAmount = totalInput - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with indefinite-length URI (should be rejected)
   */
  async buildClaimWithIndefiniteLengthURI(
    x: number,
    y: number,
    bmpHex: string
  ): Promise<string> {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x01]);
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    // Indefinite-length text string: 0x7f ... chunks ... 0xff
    const uriCbor = Buffer.from([0x7f, 0x68, 0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x2e, 0x63, 0x6f, 0xff]); // "hello.co" in chunks
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpBuffer]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with null byte in URI (should be rejected)
   */
  async buildClaimWithNullByteInURI(
    x: number,
    y: number,
    bmpHex: string
  ): Promise<string> {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x01]);
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    // URI with null byte embedded
    const uriWithNull = 'hello\u0000world';
    const uriCbor = Buffer.from(cborEncode(uriWithNull));
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, bmpBuffer]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with missing URI (truncated after y0)
   */
  async buildClaimWithMissingURI(
    x: number,
    y: number
  ): Promise<string> {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x01]);
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    // Stop after y0 - no URI or BMP
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with missing BMP (URI present but no BMP)
   */
  async buildClaimWithMissingBMP(
    x: number,
    y: number,
    uri: string
  ): Promise<string> {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x01]);
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    const uriCbor = Buffer.from(cborEncode(uri));
    // No BMP!
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with non-adjacent BMP (padding byte between URI and BMP)
   */
  async buildClaimWithNonAdjacentBMP(
    x: number,
    y: number,
    uri: string,
    bmpHex: string
  ): Promise<string> {
    const magic = Buffer.from([0x13, 0x37]);
    const version = Buffer.from([0x01]);
    const type = Buffer.from([0x01]);
    
    const xBuf = Buffer.allocUnsafe(2);
    xBuf.writeUInt16LE(x, 0);
    const yBuf = Buffer.allocUnsafe(2);
    yBuf.writeUInt16LE(y, 0);
    
    const uriCbor = Buffer.from(cborEncode(uri));
    const padding = Buffer.from([0x00]); // Extra byte!
    const bmpBuffer = Buffer.from(bmpHex, 'hex');
    
    const opReturnData = Buffer.concat([magic, version, type, xBuf, yBuf, uriCbor, padding, bmpBuffer]);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build CLAIM with long unicode URI
   */
  async buildLongUnicodeURIClaim(
    x: number,
    y: number,
    bmpHex: string
  ): Promise<string> {
    // Create a long unicode URI (>200 bytes with multi-byte characters)
    const longURI = 'https://例え.example.com/' + '🎨'.repeat(50) + '/画像データ.bmp';
    
    const opReturnData = this.buildValidClaimOpReturn(x, y, longURI, bmpHex);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }];
    
    const fee = 0.00001;
    const changeAmount = fundingUTXO.amount - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build UPDATE with long unicode URI
   */
  async buildLongUnicodeURIUpdate(
    x: number,
    y: number,
    bmpHex: string,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    // Create a long unicode URI (>200 bytes with multi-byte characters)
    const longURI = 'https://例え.example.com/' + '🎨'.repeat(50) + '/画像データ.bmp';
    
    const opReturnData = this.buildValidUpdateOpReturn(x, y, longURI, bmpHex);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00005; // Higher fee for large OP_RETURN with unicode
    const changeAmount = totalInput - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress]: 0.000006 },
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build 32-bit BMP (RGBA format)
   */
  build32BitBMP(width: number, height: number): Buffer {
    const headerSize = 54;
    const bytesPerPixel = 4; // 32-bit
    const stride = width * bytesPerPixel; // No padding needed for 32-bit
    const pixelDataSize = stride * height;
    const fileSize = headerSize + pixelDataSize;

    const buffer = Buffer.alloc(fileSize);
    
    buffer.write('BM', 0);
    buffer.writeUInt32LE(fileSize, 2);
    buffer.writeUInt32LE(0, 6);
    buffer.writeUInt32LE(headerSize, 10);
    buffer.writeUInt32LE(40, 14);
    buffer.writeInt32LE(width, 18);
    buffer.writeInt32LE(height, 22);
    buffer.writeUInt16LE(1, 26);
    buffer.writeUInt16LE(32, 28); // 32 bits per pixel
    buffer.writeUInt32LE(0, 30); // BI_RGB (no compression)
    buffer.writeUInt32LE(pixelDataSize, 34);
    buffer.writeInt32LE(0, 38);
    buffer.writeInt32LE(0, 42);
    buffer.writeUInt32LE(0, 46);
    buffer.writeUInt32LE(0, 50);

    return buffer;
  }

  /**
   * Build compressed BMP (BI_RLE8 compression)
   */
  buildCompressedBMP(width: number, height: number): Buffer {
    const headerSize = 54;
    const bytesPerPixel = 3; // Still 24-bit but marked as compressed
    const stride = Math.ceil((width * bytesPerPixel) / 4) * 4;
    const pixelDataSize = stride * height;
    const fileSize = headerSize + pixelDataSize;

    const buffer = Buffer.alloc(fileSize);
    
    buffer.write('BM', 0);
    buffer.writeUInt32LE(fileSize, 2);
    buffer.writeUInt32LE(0, 6);
    buffer.writeUInt32LE(headerSize, 10);
    buffer.writeUInt32LE(40, 14);
    buffer.writeInt32LE(width, 18);
    buffer.writeInt32LE(height, 22);
    buffer.writeUInt16LE(1, 26);
    buffer.writeUInt16LE(24, 28);
    buffer.writeUInt32LE(1, 30); // BI_RLE8 compression (invalid for 24-bit but tests rejection)
    buffer.writeUInt32LE(pixelDataSize, 34);
    buffer.writeInt32LE(0, 38);
    buffer.writeInt32LE(0, 42);
    buffer.writeUInt32LE(0, 46);
    buffer.writeUInt32LE(0, 50);

    return buffer;
  }

  /**
   * Build UPDATE with multiple 600-sat outputs (ambiguous deed)
   */
  async buildUpdateWithMultiple600SatOutputs(
    x: number,
    y: number,
    uri: string,
    bmpHex: string,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    const opReturnData = this.buildValidUpdateOpReturn(x, y, uri, bmpHex);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress1 = await this.rpcClient.getNewAddress();
    const deedAddress2 = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00005; // Higher fee for large OP_RETURN
    const changeAmount = totalInput - 0.000006 - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress1]: 0.000006 }, // First 600 sats
      { [deedAddress2]: 0.000006 }, // Second 600 sats - ambiguous!
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build RETRY with multiple 600-sat outputs (ambiguous deed)
   */
  async buildRetryWithMultiple600SatOutputs(
    x: number,
    y: number,
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    const opReturnData = this.buildValidRetryClaimOpReturn(x, y);
    
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress1 = await this.rpcClient.getNewAddress();
    const deedAddress2 = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00001;
    const changeAmount = totalInput - 0.000006 - 0.000006 - fee;
    
    const outputs = [
      { data: opReturnData.toString('hex') },
      { [deedAddress1]: 0.000006 }, // First 600 sats
      { [deedAddress2]: 0.000006 }, // Second 600 sats - ambiguous!
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build TRANSFER with multiple 600-sat outputs (ambiguous deed)
   */
  async buildTransferWithMultiple600SatOutputs(
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    const fundingUTXO = await this.walletManager.getSpendableUTXO(10000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress1 = await this.rpcClient.getNewAddress();
    const deedAddress2 = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00001;
    const changeAmount = totalInput - 0.000006 - 0.000006 - fee;
    
    const outputs = [
      { [deedAddress1]: 0.000006 }, // First 600 sats
      { [deedAddress2]: 0.000006 }, // Second 600 sats - ambiguous!
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }

  /**
   * Build TRANSFER with extra outputs (diverse script types)
   * Note: In regtest we can only easily test P2PKH and P2WPKH
   */
  async buildTransferWithExtraOutputs(
    deedInput: { txid: string; vout: number; amount: number }
  ): Promise<string> {
    const fundingUTXO = await this.walletManager.getSpendableUTXO(20000);
    const changeAddress = await this.rpcClient.getNewAddress();
    const deedAddress = await this.rpcClient.getNewAddress();
    const extraAddress1 = await this.rpcClient.getNewAddress();
    const extraAddress2 = await this.rpcClient.getNewAddress();
    const extraAddress3 = await this.rpcClient.getNewAddress();

    const inputs = [
      { txid: deedInput.txid, vout: deedInput.vout },
      { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
    ];
    
    const totalInput = deedInput.amount + fundingUTXO.amount;
    const fee = 0.00001;
    const changeAmount = totalInput - 0.000006 - 0.00001 - 0.00001 - 0.00001 - fee;
    
    const outputs = [
      { [deedAddress]: 0.000006 }, // 600 sat deed
      { [extraAddress1]: 0.00001 }, // Extra output 1
      { [extraAddress2]: 0.00001 }, // Extra output 2
      { [extraAddress3]: 0.00001 }, // Extra output 3
      { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
    ];

    const rawTx = await this.txBuilder.buildRawTransaction(inputs, outputs);
    const signedHex = await this.txBuilder.signTransaction(rawTx);
    return await this.txBuilder.broadcastTransaction(signedHex);
  }
}
