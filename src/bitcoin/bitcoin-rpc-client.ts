/**
 * Bitcoin RPC Client for regtest testing
 * 
 * Provides methods to interact with a Bitcoin Core regtest node via JSON-RPC
 */

import axios, { AxiosInstance } from 'axios';

export interface UTXO {
  txid: string;
  vout: number;
  address: string;
  amount: number; // in BTC
  scriptPubKey: string;
  spendable: boolean;
  solvable: boolean;
  confirmations: number;
}

export interface BlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  mediantime: number;
  verificationprogress: number;
  initialblockdownload: boolean;
  chainwork: string;
  size_on_disk: number;
  pruned: boolean;
}

export interface SignedTransaction {
  hex: string;
  complete: boolean;
}

export class BitcoinRpcClient {
  private readonly rpcUrl: string;
  private readonly axios: AxiosInstance;
  private requestId: number = 0;
  private walletName: string | null = null;

  constructor(rpcUrl: string = 'http://user:password@127.0.0.1:18443') {
    this.rpcUrl = rpcUrl;
    this.axios = axios.create({
      baseURL: rpcUrl,
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000 // 120 seconds for mining operations
    });
  }

  /**
   * Set the active wallet for wallet-specific RPC calls
   */
  setWallet(walletName: string): void {
    this.walletName = walletName;
  }

  /**
   * Make a JSON-RPC call to the Bitcoin node
   */
  private async call<T = any>(method: string, params: any[] = [], useWallet: boolean = true): Promise<T> {
    this.requestId++;
    const payload = {
      jsonrpc: '1.0',
      id: `ubb-regtest-${this.requestId}`,
      method,
      params
    };

    // Use wallet-specific endpoint if wallet is set and method requires it
    const endpoint = (useWallet && this.walletName) ? `/wallet/${this.walletName}` : '';

    try {
      const response = await this.axios.post(endpoint, payload);
      
      if (response.data && response.data.error) {
        throw new Error(`RPC error (${method}): ${response.data.error.message || 'unknown'}`);
      }

      return response.data.result as T;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        throw new Error(`RPC error (${method}): ${error.response.data.error.message || 'unknown'}`);
      }
      throw new Error(`RPC call failed (${method}): ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  /**
   * Create a new wallet
   */
  async createWallet(name: string, disablePrivateKeys: boolean = false): Promise<{ name: string; warning: string }> {
    const result = await this.call<{ name: string; warning: string }>('createwallet', [name, disablePrivateKeys], false);
    this.walletName = name; // Set active wallet
    return result;
  }

  /**
   * Load an existing wallet
   */
  async loadWallet(name: string): Promise<{ name: string; warning: string }> {
    const result = await this.call<{ name: string; warning: string }>('loadwallet', [name], false);
    this.walletName = name; // Set active wallet
    return result;
  }

  /**
   * Get a new address from the loaded wallet
   */
  async getNewAddress(label: string = '', addressType: string = 'bech32'): Promise<string> {
    return this.call<string>('getnewaddress', [label, addressType]);
  }

  /**
   * Generate blocks to a specific address
   */
  async generateToAddress(nBlocks: number, address: string): Promise<string[]> {
    return this.call<string[]>('generatetoaddress', [nBlocks, address]);
  }

  /**
   * List unspent transaction outputs
   */
  async listUnspent(minConf: number = 1, maxConf: number = 9999999): Promise<UTXO[]> {
    return this.call<UTXO[]>('listunspent', [minConf, maxConf]);
  }

  /**
   * Lock or unlock specific UTXOs
   * @param unlock true to unlock, false to lock
   * @param outputs Array of {txid, vout} to lock/unlock
   * @returns true if successful
   */
  async lockUnspent(unlock: boolean, outputs: Array<{txid: string, vout: number}>): Promise<boolean> {
    return this.call<boolean>('lockunspent', [unlock, outputs]);
  }

  /**
   * List all currently locked UTXOs
   * @returns Array of locked UTXOs as {txid, vout}
   */
  async listLockUnspent(): Promise<Array<{txid: string, vout: number}>> {
    return this.call<Array<{txid: string, vout: number}>>('listlockunspent', []);
  }

  /**
   * Fund a raw transaction with inputs and change output
   * Uses vBytes for accurate fee calculation
   * @param hexstring Raw transaction hex
   * @param options Funding options (add_inputs, changeAddress, feeRate, etc.)
   * @returns Object with funded hex and fee
   */
  async fundRawTransaction(
    hexstring: string, 
    options?: {
      add_inputs?: boolean;
      changeAddress?: string;
      changePosition?: number;
      includeWatching?: boolean;
      lockUnspents?: boolean;
      feeRate?: number; // BTC/kB (not sat/vB!)
      subtractFeeFromOutputs?: number[];
    }
  ): Promise<{hex: string, fee: number, changepos: number}> {
    return this.call<{hex: string, fee: number, changepos: number}>(
      'fundrawtransaction', 
      options ? [hexstring, options] : [hexstring]
    );
  }

  /**
   * Create a raw transaction
   */
  async createRawTransaction(inputs: { txid: string; vout: number }[], outputs: Record<string, number | string>[]): Promise<string> {
    return this.call<string>('createrawtransaction', [inputs, outputs]);
  }

  /**
   * Sign a raw transaction with the wallet
   */
  async signRawTransactionWithWallet(hexString: string): Promise<SignedTransaction> {
    return this.call<SignedTransaction>('signrawtransactionwithwallet', [hexString]);
  }

  /**
   * Send a raw transaction to the network
   */
  async sendRawTransaction(hexString: string): Promise<string> {
    return this.call<string>('sendrawtransaction', [hexString], false);
  }

  /**
   * Get block hash at a specific height
   */
  async getBlockHash(height: number): Promise<string> {
    return this.call<string>('getblockhash', [height], false);
  }

  /**
   * Get blockchain info
   */
  async getBlockchainInfo(): Promise<BlockchainInfo> {
    return this.call<BlockchainInfo>('getblockchaininfo', [], false);
  }

  /**
   * Get best block hash (current tip)
   */
  async getBestBlockHash(): Promise<string> {
    const info = await this.getBlockchainInfo();
    return info.bestblockhash;
  }

  /**
   * Unload a wallet
   */
  async unloadWallet(walletName: string): Promise<void> {
    await this.call('unloadwallet', [walletName], false);
  }

  /**
   * Get raw transaction (verbose)
   */
  async getRawTransaction(txid: string, verbose: boolean = true): Promise<any> {
    return this.call('getrawtransaction', [txid, verbose], false);
  }

  /**
   * Get block by hash
   */
  async getBlock(blockHash: string, verbosity: number = 1): Promise<any> {
    return this.call('getblock', [blockHash, verbosity], false);
  }

  /**
   * Decode a raw transaction
   */
  async decodeRawTransaction(hexString: string): Promise<any> {
    return this.call('decoderawtransaction', [hexString], false);
  }

  /**
   * Unlock wallet with passphrase
   */
  async walletPassphrase(passphrase: string, timeout: number = 60): Promise<null> {
    return this.call<null>('walletpassphrase', [passphrase, timeout]);
  }

  /**
   * Test connection to the node
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getBlockchainInfo();
      return true;
    } catch (error) {
      return false;
    }
  }
}
