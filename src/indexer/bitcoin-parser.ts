/**
 * Bitcoin blockchain data parser using bitcore-lib
 */

import * as bitcore from 'bitcore-lib';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { BlockInfo, DeedUTXO } from './types';
import { BlockSource, ApiBlockSource, RpcBlockSource } from './block-sources';
import { UBBTransactionValidator } from '../validators/transaction-validator-shared';

export class BitcoinParser {
  private readonly dataDir: string;
  private readonly blockchainInfoUrl: string;
  private readonly network: string;
  private readonly blockSource: BlockSource;

  constructor(dataDir: string, blockchainInfoUrl: string = 'https://blockchain.info', network: string = 'mainnet', blockSource?: 'api' | 'rpc', rpcUrl?: string) {
    this.dataDir = dataDir;
    this.blockchainInfoUrl = blockchainInfoUrl;
    this.network = network;
    
    // Configure bitcore-lib network
    this.configureNetwork();
    
    // Ensure rawblock directory exists with network subdirectory
    const rawBlockDir = path.join(dataDir, network, 'rawblock');
    if (!fs.existsSync(rawBlockDir)) {
      fs.mkdirSync(rawBlockDir, { recursive: true });
    }

    // Select block source
    if (blockSource === 'rpc') {
      this.blockSource = new RpcBlockSource(
        rpcUrl || 'http://user:password@127.0.0.1:18443',
        (network as 'mainnet' | 'testnet' | 'regtest')
      );
    } else {
      this.blockSource = new ApiBlockSource(this.getApiUrl(), network as 'mainnet' | 'testnet' | 'regtest');
    }
  }

  /**
   * Get the appropriate API URL for the network
   */
  private getApiUrl(): string {
    if (this.network === 'testnet') {
      return 'https://mempool.space/testnet/api';
    }
    if (this.network === 'regtest') {
      throw new Error('Regtest network requires RPC block source. Use --block-source rpc --rpc-url <url>');
    }
    return this.blockchainInfoUrl;
  }

  /**
   * Configure bitcore-lib network for mainnet or testnet
   */
  private configureNetwork(): void {
    if (this.network === 'testnet' || this.network === 'regtest') {
      bitcore.Networks.defaultNetwork = bitcore.Networks.testnet;
    } else {
      bitcore.Networks.defaultNetwork = bitcore.Networks.livenet;
    }
  }

  /**
   * Parse raw hex block data using bitcore-lib
   */
  parseBlock(rawHex: string): bitcore.Block {
    try {
      return new bitcore.Block(Buffer.from(rawHex, 'hex'));
    } catch (error) {
      throw new Error(`Failed to parse block: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract block information from parsed block
   */
  extractBlockInfo(block: bitcore.Block, height?: number): BlockInfo {
    let parentHash = '';
    if (block.prevHash) {
      parentHash = block.prevHash.toString();
    } else if (block.header && block.header.prevHash) {
      // Convert Buffer to hex string and reverse it (Bitcoin uses little-endian)
      const buffer = block.header.prevHash;
      const reversed = Buffer.from(buffer).reverse();
      parentHash = reversed.toString('hex');
    }

    return {
      hash: block.hash.toString(),
      parentHash: parentHash,
      height: height !== undefined ? height : -1, // Height not available in block data unless provided
      timestamp: block.time,
      transactionCount: block.transactions.length
    };
  }
  
  /**
   * Get the block height for a given block hash
   */
  async getBlockHeight(blockHash: string): Promise<number> {
    try {
      return await this.blockSource.getBlockHeight(blockHash);
    } catch (error) {
      throw new Error(`Failed to get block height for ${blockHash}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a transaction is a UBB transaction
   */
  isUBBTransaction(tx: bitcore.Transaction, knownDeedUTXOs: string[] = []): boolean {
    return UBBTransactionValidator.isUBBTransaction(tx, knownDeedUTXOs);
  }

  /**
   * Extract OP_RETURN data from transaction
   * Delegates to shared validator for consistency
   */
  extractOpReturnData(tx: bitcore.Transaction): Buffer | null {
    const result = UBBTransactionValidator.validateTransaction(tx);
    return result.details.opReturnData?.rawData || null;
  }

  /**
   * Find deed UTXOs in transaction outputs
   * Delegates to shared validator for consistency
   */
  findDeedUTXOs(tx: bitcore.Transaction, deedValue: number = 600): DeedUTXO[] {
    // Use the public method that works for all transactions, including TRANSFER
    return UBBTransactionValidator.findDeedOutputs(tx, deedValue).map(deed => ({
      ...deed,
      address: deed.address || 'unknown'
    }));
  }

  /**
   * Check if transaction has exactly one deed UTXO
   */
  hasSingleDeedUTXO(tx: bitcore.Transaction, deedValue: number = 600): boolean {
    const result = UBBTransactionValidator.validateTransaction(tx);
    return result.details.hasSingleDeedUTXO;
  }

  /**
   * Check if transaction has multiple UBB OP_RETURN outputs
   */
  hasMultipleOpReturns(tx: bitcore.Transaction): boolean {
    const result = UBBTransactionValidator.validateTransaction(tx);
    return result.warnings.some(w => w.includes('UBB OP_RETURN outputs'));
  }

  /**
   * Download raw block data from the appropriate API
   */
  async downloadBlock(blockHash: string): Promise<string> {
    try {
      return await this.blockSource.getBlockHex(blockHash);
    } catch (error) {
      throw new Error(`Failed to download block ${blockHash}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current chain tip block hash
   */
  async getTipHash(): Promise<string> {
    try {
      return await this.blockSource.getTipHash();
    } catch (error) {
      throw new Error(`Failed to get chain tip: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the block hash at a specific height
   */
  async getBlockHashAtHeight(height: number): Promise<string> {
    try {
      return await this.blockSource.getBlockHashAtHeight(height);
    } catch (error) {
      throw new Error(`Failed to get block hash at height ${height}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save raw block data to disk
   */
  saveRawBlock(blockHash: string, rawHex: string): void {
    const rawBlockDir = path.join(this.dataDir, this.network, 'rawblock');
    if (!fs.existsSync(rawBlockDir)) {
      fs.mkdirSync(rawBlockDir, { recursive: true });
    }
    
    const filePath = path.join(rawBlockDir, blockHash);
    fs.writeFileSync(filePath, rawHex);
  }

  /**
   * Load raw block data from disk
   */
  loadRawBlock(blockHash: string): string | null {
    const filePath = path.join(this.dataDir, this.network, 'rawblock', blockHash);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8');
    }
    return null;
  }

  /**
   * Check if raw block data exists on disk
   */
  hasRawBlock(blockHash: string): boolean {
    const filePath = path.join(this.dataDir, this.network, 'rawblock', blockHash);
    return fs.existsSync(filePath);
  }

}
