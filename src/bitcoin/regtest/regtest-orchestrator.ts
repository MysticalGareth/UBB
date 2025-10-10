/**
 * Regtest Orchestrator
 * 
 * High-level API for regtest testing that orchestrates all helper components
 */

import { BitcoinRpcClient } from '../bitcoin-rpc-client';
import { WalletManager, WalletConfig } from '../wallet-manager';
import { TransactionBuilder, ClaimTransactionResult } from '../transaction-builder';
import { BlockManager } from './block-manager';
import { execSync } from 'child_process';
import * as path from 'path';

export interface RegtestConfig {
  rpcUrl?: string;
  autoMine?: boolean; // Automatically mine blocks after transactions
  walletName?: string; // Wallet name to use (required for mainnet/testnet)
  walletPassphrase?: string; // Optional wallet passphrase
  createWalletIfNotExists?: boolean; // Create wallet if it doesn't exist (regtest only)
  fundWallet?: boolean; // Fund wallet by mining blocks (regtest only, defaults to true for regtest)
  feeRate?: number; // Fee rate in sat/vByte (default: 1)
}

export class RegtestOrchestrator {
  private readonly rpcClient: BitcoinRpcClient;
  private readonly walletManager: WalletManager;
  private readonly transactionBuilder: TransactionBuilder;
  private readonly blockManager: BlockManager;
  private readonly config: RegtestConfig;
  private isSetup: boolean = false;

  constructor(config: RegtestConfig = {}) {
    this.config = {
      rpcUrl: config.rpcUrl || 'http://user:password@127.0.0.1:18443',
      autoMine: config.autoMine !== undefined ? config.autoMine : false,
      walletName: config.walletName,
      walletPassphrase: config.walletPassphrase,
      createWalletIfNotExists: config.createWalletIfNotExists !== undefined ? config.createWalletIfNotExists : true,
      fundWallet: config.fundWallet !== undefined ? config.fundWallet : true,
      feeRate: config.feeRate ?? 1
    };

    this.rpcClient = new BitcoinRpcClient(this.config.rpcUrl);
    
    const walletConfig: WalletConfig = {
      walletName: this.config.walletName,
      walletPassphrase: this.config.walletPassphrase,
      createIfNotExists: this.config.createWalletIfNotExists,
      fundWallet: this.config.fundWallet
    };
    
    this.walletManager = new WalletManager(this.rpcClient, walletConfig);
    this.transactionBuilder = new TransactionBuilder(this.rpcClient, this.walletManager, this.config.feeRate);
    this.blockManager = new BlockManager(this.rpcClient);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ensure regtest node is running (chain-only check, no wallet RPC).
   * - If node unreachable: run ./regtest-cleaner and ./regtest-bitcoind -daemon
   */
  private async ensureRegtestNodeUp(): Promise<void> {
    let connected = await this.rpcClient.testConnection();

    if (!connected) {
      try {
        const cleaner = path.resolve(process.cwd(), 'regtest-cleaner');
        const starter = path.resolve(process.cwd(), 'regtest-bitcoind');
        try { execSync(`${cleaner}`, { stdio: 'inherit' }); } catch {}
        execSync(`${starter} -daemon`, { stdio: 'inherit' });
      } catch (error) {
        // Best effort; proceed to wait and check
      }

      // Wait up to ~10s for node
      for (let i = 0; i < 20; i++) {
        connected = await this.rpcClient.testConnection();
        if (connected) break;
        await this.sleep(500);
      }
      if (!connected) {
        throw new Error('Cannot start or connect to regtest node');
      }
    }
  }

  /**
   * Fast-path: check if wallet has mature UTXOs, mine if needed.
   * REGTEST ONLY - uses generateToAddress which doesn't exist on mainnet/testnet.
   * MUST be called AFTER wallet is loaded.
   */
  private async ensureWalletFunded(): Promise<void> {
    try {
      const info = await this.rpcClient.getBlockchainInfo();
      const utxos = await this.rpcClient.listUnspent(1);

      // If coinbase not matured or no UTXOs, mine 101 blocks to a fresh address
      // This is safe because this orchestrator is regtest-only
      if (info.blocks < 101 || utxos.length === 0) {
        const addr = await this.rpcClient.getNewAddress();
        await this.rpcClient.generateToAddress(101, addr);
      }
    } catch (error) {
      // As a fallback, attempt to mine 101 blocks
      const addr = await this.rpcClient.getNewAddress();
      await this.rpcClient.generateToAddress(101, addr);
    }
  }

  /**
   * Setup the regtest environment
   * Creates a new wallet and funds it with matured coinbase rewards
   */
  async setup(): Promise<void> {
    if (this.isSetup) {
      console.log('Orchestrator already setup, skipping...');
      return;
    }

    console.log('Setting up regtest orchestrator...');

    // Step 1: Chain-only check - ensure node is up (no wallet RPC)
    await this.ensureRegtestNodeUp();

    // Step 2: Setup/load wallet (sets wallet on RPC client)
    const walletName = await this.walletManager.setupWallet();
    console.log(`Wallet created: ${walletName}`);

    // Step 3: Fast-path - check UTXOs and mine if needed (requires wallet)
    await this.ensureWalletFunded();

    // Fund wallet (additional mining if configured)
    await this.walletManager.fundWallet();
    
    // Set mining address
    const fundingAddress = this.walletManager.getFundingAddress();
    if (fundingAddress) {
      this.blockManager.setMiningAddress(fundingAddress);
    }

    this.isSetup = true;
    console.log('Regtest orchestrator setup complete');
  }

  /**
   * Create a CLAIM transaction
   * 
   * @param x X coordinate (0-65534)
   * @param y Y coordinate (0-65534)
   * @param uri URI string (can be empty)
   * @param bmpHex BMP file as hex string (no 0x prefix)
   * @param broadcast Whether to broadcast the transaction (default: true)
   * @param recipientAddress Optional address for the deed output (if not provided, generates new address)
   * @returns Transaction result with txid and deed UTXO
   */
  async createClaimTx(
    x: number,
    y: number,
    uri: string,
    bmpHex: string,
    broadcast: boolean = true,
    recipientAddress?: string
  ): Promise<ClaimTransactionResult> {
    if (!this.isSetup) {
      throw new Error('Orchestrator not setup. Call setup() first.');
    }

    const result = await this.transactionBuilder.buildClaimTransaction(x, y, uri, bmpHex, undefined, undefined, recipientAddress, broadcast);

    // Auto-mine if configured (only if transaction was broadcast)
    if (this.config.autoMine && broadcast) {
      await this.mineBlock();
    }

    return result;
  }

  /**
   * Create a RETRY-CLAIM transaction
   * 
   * @param x New X coordinate (0-65534)
   * @param y New Y coordinate (0-65534)
   * @param deedUTXO Deed UTXO string in format "txid:vout" or full ClaimTransactionResult
   * @param broadcast Whether to broadcast the transaction (default: true)
   * @param recipientAddress Optional address for the deed output (if not provided, generates new address)
   * @returns Transaction result with txid and deed UTXO
   */
  async createRetryClaimTx(
    x: number,
    y: number,
    deedUTXO: string | ClaimTransactionResult,
    broadcast: boolean = true,
    recipientAddress?: string
  ): Promise<ClaimTransactionResult> {
    if (!this.isSetup) {
      throw new Error('Orchestrator not setup. Call setup() first.');
    }

    let txid: string;
    let vout: number;

    // Parse deed UTXO
    if (typeof deedUTXO === 'string') {
      const parts = deedUTXO.split(':');
      if (parts.length !== 2) {
        throw new Error(`Invalid deedUTXO format: ${deedUTXO}. Expected "txid:vout"`);
      }
      txid = parts[0];
      vout = parseInt(parts[1], 10);
    } else {
      // Extract from ClaimTransactionResult
      const parts = deedUTXO.deedUTXO.split(':');
      txid = parts[0];
      vout = parseInt(parts[1], 10);
    }

    // Get the transaction output value (deed is always 600 sats = 0.000006 BTC)
    const deedInput = {
      txid,
      vout,
      amount: 0.000006
    };

    const result = await this.transactionBuilder.buildRetryClaimTransaction(x, y, deedInput, undefined, recipientAddress, broadcast);

    // Auto-mine if configured (only if transaction was broadcast)
    if (this.config.autoMine && broadcast) {
      await this.mineBlock();
    }

    return result;
  }

  /**
   * Create an UPDATE transaction
   * 
   * @param x X coordinate (must match original plot)
   * @param y Y coordinate (must match original plot)
   * @param uri URI string
   * @param bmpHex BMP image hex string (dimensions must match original plot)
   * @param deedUTXO Deed UTXO string in format "txid:vout" or full ClaimTransactionResult
   * @param broadcast Whether to broadcast the transaction (default: true)
   * @param recipientAddress Optional address for the deed output (if not provided, generates new address)
   * @returns Transaction result with txid and deed UTXO
   */
  async createUpdateTx(
    x: number,
    y: number,
    uri: string,
    bmpHex: string,
    deedUTXO: string | ClaimTransactionResult,
    broadcast: boolean = true,
    recipientAddress?: string
  ): Promise<ClaimTransactionResult> {
    if (!this.isSetup) {
      throw new Error('Orchestrator not setup. Call setup() first.');
    }

    let txid: string;
    let vout: number;

    // Parse deed UTXO
    if (typeof deedUTXO === 'string') {
      const parts = deedUTXO.split(':');
      if (parts.length !== 2) {
        throw new Error(`Invalid deedUTXO format: ${deedUTXO}. Expected "txid:vout"`);
      }
      txid = parts[0];
      vout = parseInt(parts[1], 10);
    } else {
      // Extract from ClaimTransactionResult
      const parts = deedUTXO.deedUTXO.split(':');
      txid = parts[0];
      vout = parseInt(parts[1], 10);
    }

    // Get the transaction output value (deed is always 600 sats = 0.000006 BTC)
    const deedInput = {
      txid,
      vout,
      amount: 0.000006
    };

    const result = await this.transactionBuilder.buildUpdateTransaction(x, y, uri, bmpHex, deedInput, undefined, recipientAddress, broadcast);

    // Auto-mine if configured (only if transaction was broadcast)
    if (this.config.autoMine && broadcast) {
      await this.mineBlock();
    }

    return result;
  }

  /**
   * Create a TRANSFER transaction
   * 
   * @param deedUTXO Deed UTXO string in format "txid:vout" or full ClaimTransactionResult
   * @param recipientAddress Address to receive the new deed UTXO (optional, generates new address if not provided)
   * @returns Transaction result with txid and deed UTXO
   */
  async createTransferTx(
    deedUTXO: string | ClaimTransactionResult,
    recipientAddress?: string
  ): Promise<ClaimTransactionResult> {
    if (!this.isSetup) {
      throw new Error('Orchestrator not setup. Call setup() first.');
    }

    let txid: string;
    let vout: number;

    // Parse deed UTXO
    if (typeof deedUTXO === 'string') {
      const parts = deedUTXO.split(':');
      if (parts.length !== 2) {
        throw new Error(`Invalid deedUTXO format: ${deedUTXO}. Expected "txid:vout"`);
      }
      txid = parts[0];
      vout = parseInt(parts[1], 10);
    } else {
      // Extract from ClaimTransactionResult
      const parts = deedUTXO.deedUTXO.split(':');
      txid = parts[0];
      vout = parseInt(parts[1], 10);
    }

    // Get the transaction output value (deed is always 600 sats = 0.000006 BTC)
    const deedInput = {
      txid,
      vout,
      amount: 0.000006
    };

    const result = await this.transactionBuilder.buildTransferTransaction(
      deedInput,
      undefined, // changeAddress - let it generate automatically
      recipientAddress // deedAddress - recipient of the transfer
    );

    // Auto-mine if configured
    if (this.config.autoMine) {
      await this.mineBlock();
    }

    return result;
  }

  /**
   * Mine a single block
   * @returns Block hash
   */
  async mineBlock(): Promise<string> {
    if (!this.isSetup) {
      throw new Error('Orchestrator not setup. Call setup() first.');
    }

    return this.blockManager.mineBlock();
  }

  /**
   * Mine multiple blocks
   * @param n Number of blocks to mine
   * @returns Array of block hashes
   */
  async mineBlocks(n: number): Promise<string[]> {
    if (!this.isSetup) {
      throw new Error('Orchestrator not setup. Call setup() first.');
    }

    return this.blockManager.mineBlocks(n);
  }

  /**
   * Get current blockchain height
   */
  async getCurrentHeight(): Promise<number> {
    return this.blockManager.getCurrentHeight();
  }

  /**
   * Get block hash at specific height
   */
  async getBlockHashAtHeight(height: number): Promise<string> {
    return this.blockManager.getBlockHashAtHeight(height);
  }

  /**
   * Get the best block hash (chain tip)
   */
  async getBestBlockHash(): Promise<string> {
    return this.blockManager.getBestBlockHash();
  }

  /**
   * Get wallet manager for direct access
   */
  getWalletManager(): WalletManager {
    return this.walletManager;
  }

  /**
   * Get transaction builder for direct access (for advanced testing)
   */
  getTransactionBuilder(): TransactionBuilder {
    return this.transactionBuilder;
  }

  /**
   * Get block manager for direct access
   */
  getBlockManager(): BlockManager {
    return this.blockManager;
  }

  /**
   * Get RPC client for direct access (for advanced testing)
   */
  getRpcClient(): BitcoinRpcClient {
    return this.rpcClient;
  }

  /**
   * Test if regtest node is available
   */
  async testConnection(): Promise<boolean> {
    return this.rpcClient.testConnection();
  }

  /**
   * Cleanup - no-op since we assume dirty regtest state
   * Kept for API compatibility
   */
  async cleanup(): Promise<void> {
    console.log('Cleanup called - no action needed (assumes dirty state)');
  }

  /**
   * Get blockchain info
   */
  async getBlockchainInfo() {
    return this.rpcClient.getBlockchainInfo();
  }

  /**
   * Get block transactions in serialization order
   * This is used to determine deterministic winners in same-block conflicts
   * 
   * @param blockHash Block hash to fetch
   * @returns Array of transaction IDs in block serialization order
   */
  async getBlockTransactions(blockHash: string): Promise<string[]> {
    // verbosity=1 returns block with tx IDs in serialization order
    const block = await this.rpcClient.getBlock(blockHash, 1);
    return block.tx; // Array of transaction IDs in order
  }
}
