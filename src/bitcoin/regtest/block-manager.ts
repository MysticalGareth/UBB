/**
 * Block Manager for regtest testing
 * 
 * Manages block generation and chain state queries
 */

import { BitcoinRpcClient } from '../bitcoin-rpc-client';

export class BlockManager {
  private readonly rpcClient: BitcoinRpcClient;
  private miningAddress: string | null = null;

  constructor(rpcClient: BitcoinRpcClient) {
    this.rpcClient = rpcClient;
  }

  /**
   * Set the address to mine blocks to
   */
  setMiningAddress(address: string): void {
    this.miningAddress = address;
  }

  /**
   * Mine a single block
   * @returns Block hash of the mined block
   */
  async mineBlock(): Promise<string> {
    if (!this.miningAddress) {
      // Get a new address if none is set
      this.miningAddress = await this.rpcClient.getNewAddress();
    }

    const blockHashes = await this.rpcClient.generateToAddress(1, this.miningAddress);
    
    if (blockHashes.length !== 1) {
      throw new Error('Expected exactly one block hash from generatetoaddress');
    }

    const blockHash = blockHashes[0];
    console.log(`Mined block: ${blockHash}`);
    
    return blockHash;
  }

  /**
   * Mine multiple blocks
   * @param n Number of blocks to mine
   * @returns Array of block hashes
   */
  async mineBlocks(n: number): Promise<string[]> {
    if (n <= 0) {
      return [];
    }

    if (!this.miningAddress) {
      this.miningAddress = await this.rpcClient.getNewAddress();
    }

    const blockHashes = await this.rpcClient.generateToAddress(n, this.miningAddress);
    console.log(`Mined ${n} blocks`);
    
    return blockHashes;
  }

  /**
   * Get current blockchain height
   */
  async getCurrentHeight(): Promise<number> {
    const info = await this.rpcClient.getBlockchainInfo();
    return info.blocks;
  }

  /**
   * Get block hash at a specific height
   */
  async getBlockHashAtHeight(height: number): Promise<string> {
    return this.rpcClient.getBlockHash(height);
  }

  /**
   * Get the best block hash (tip)
   */
  async getBestBlockHash(): Promise<string> {
    const info = await this.rpcClient.getBlockchainInfo();
    return info.bestblockhash;
  }

  /**
   * Get block info
   */
  async getBlockInfo(blockHash: string): Promise<any> {
    return this.rpcClient.getBlock(blockHash, 1);
  }

  /**
   * Wait for a specific number of confirmations for a transaction
   */
  async waitForConfirmations(txid: string, confirmations: number = 1): Promise<void> {
    let confirmed = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!confirmed && attempts < maxAttempts) {
      try {
        const txInfo = await this.rpcClient.getRawTransaction(txid, true);
        if (txInfo.confirmations && txInfo.confirmations >= confirmations) {
          confirmed = true;
        } else {
          // Mine a block to get confirmations
          await this.mineBlock();
        }
      } catch (error) {
        // Transaction might not be in a block yet
        await this.mineBlock();
      }
      attempts++;
    }

    if (!confirmed) {
      throw new Error(`Failed to get ${confirmations} confirmations for transaction ${txid}`);
    }
  }
}
