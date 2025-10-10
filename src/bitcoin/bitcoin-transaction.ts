/**
 * Stub class representing a Bitcoin transaction for testing purposes
 * Eventually this will be replaced with real Bitcoin transaction data
 */
export class BitcoinTransaction {
  private readonly _txid: string;
  private readonly _inputs: BitcoinInput[];
  private readonly _outputs: BitcoinOutput[];
  private readonly _locktime: number;
  private readonly _version: number;

  constructor(
    txid: string,
    inputs: BitcoinInput[],
    outputs: BitcoinOutput[],
    locktime: number = 0,
    version: number = 1
  ) {
    this._txid = txid;
    this._inputs = inputs;
    this._outputs = outputs;
    this._locktime = locktime;
    this._version = version;
  }

  /**
   * Transaction ID
   */
  get txid(): string {
    return this._txid;
  }

  /**
   * Transaction inputs
   */
  get inputs(): readonly BitcoinInput[] {
    return this._inputs;
  }

  /**
   * Transaction outputs
   */
  get outputs(): readonly BitcoinOutput[] {
    return this._outputs;
  }

  /**
   * Transaction locktime
   */
  get locktime(): number {
    return this._locktime;
  }

  /**
   * Transaction version
   */
  get version(): number {
    return this._version;
  }

  /**
   * Gets OP_RETURN outputs (should be at most 1 for UBB transactions)
   */
  get opReturnOutputs(): BitcoinOutput[] {
    return this._outputs.filter(output => output.isOpReturn);
  }

  /**
   * Gets regular outputs (non-OP_RETURN)
   */
  get regularOutputs(): BitcoinOutput[] {
    return this._outputs.filter(output => !output.isOpReturn);
  }

  /**
   * Gets the total input value in satoshis
   */
  get totalInputValue(): number {
    return this._inputs.reduce((sum, input) => sum + input.value, 0);
  }

  /**
   * Gets the total output value in satoshis
   */
  get totalOutputValue(): number {
    return this._outputs.reduce((sum, output) => sum + output.value, 0);
  }

  /**
   * Gets the transaction fee in satoshis
   */
  get fee(): number {
    return this.totalInputValue - this.totalOutputValue;
  }

  /**
   * Checks if this transaction has exactly one OP_RETURN output
   */
  get hasSingleOpReturn(): boolean {
    return this.opReturnOutputs.length === 1;
  }

  /**
   * Gets the OP_RETURN data if present
   */
  get opReturnData(): Buffer | null {
    const opReturnOutput = this.opReturnOutputs[0];
    return opReturnOutput ? opReturnOutput.data : null;
  }

  /**
   * Checks if this is a UBB transaction
   * @param ubbDeedUTXOs List of known UBB deed UTXOs (txid:vout format)
   * @returns true if this is a UBB transaction
   */
  isUBB(ubbDeedUTXOs: string[] = []): boolean {
    // Check if any input is a known UBB deed UTXO
    const hasDeedUtxo = this._inputs.some(input => 
      ubbDeedUTXOs.includes(`${input.txid}:${input.vout}`)
    );

    if (hasDeedUtxo) {
      return true;
    }

    // Check if OP_RETURN output begins with UBB magic bytes (0x13 0x37)
    if (this.opReturnData && this.opReturnData.length >= 2) {
      const magicBytes = this.opReturnData.subarray(0, 2);
      return magicBytes.equals(Buffer.from([0x13, 0x37]));
    }

    return false;
  }
}

/**
 * Represents a Bitcoin transaction input
 */
export class BitcoinInput {
  private readonly _txid: string;
  private readonly _vout: number;
  private readonly _value: number;
  private readonly _scriptSig: Buffer;

  constructor(txid: string, vout: number, value: number, scriptSig: Buffer = Buffer.alloc(0)) {
    this._txid = txid;
    this._vout = vout;
    this._value = value;
    this._scriptSig = scriptSig;
  }

  get txid(): string {
    return this._txid;
  }

  get vout(): number {
    return this._vout;
  }

  get value(): number {
    return this._value;
  }

  get scriptSig(): Buffer {
    return this._scriptSig;
  }
}

/**
 * Represents a Bitcoin transaction output
 */
export class BitcoinOutput {
  private readonly _value: number;
  private readonly _scriptPubKey: Buffer;
  private readonly _isOpReturn: boolean;
  private readonly _data: Buffer | null;

  constructor(
    value: number, 
    scriptPubKey: Buffer, 
    isOpReturn: boolean = false, 
    data: Buffer | null = null
  ) {
    this._value = value;
    this._scriptPubKey = scriptPubKey;
    this._isOpReturn = isOpReturn;
    this._data = data;
  }

  get value(): number {
    return this._value;
  }

  get scriptPubKey(): Buffer {
    return this._scriptPubKey;
  }

  get isOpReturn(): boolean {
    return this._isOpReturn;
  }

  get data(): Buffer | null {
    return this._data;
  }
}
