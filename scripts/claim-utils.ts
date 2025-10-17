/**
 * Shared utilities for creating UBB transactions
 */

import * as fs from 'fs';
import { RegtestOrchestrator } from '../src/bitcoin/regtest';
import { BitcoinRpcClient, WalletManager, TransactionBuilder } from '../src/bitcoin';

export interface ClaimConfig {
  network: 'regtest' | 'mainnet' | 'testnet';
  rpcUrl?: string;
  walletName?: string;
  walletPassphrase?: string;
  feeRate?: number; // Fee rate in sat/vByte (default: 1)
}

export interface ClaimResult {
  txid: string;
  deedUTXO: string;
  hex: string;
}

/**
 * Bitcoin components for mainnet/testnet networks
 * Just the core RPC components - no orchestration needed
 */
export interface BitcoinComponents {
  rpcClient: BitcoinRpcClient;
  walletManager: WalletManager;
  transactionBuilder: TransactionBuilder;
}

/**
 * Setup Bitcoin components for mainnet/testnet
 * Just initializes the core RPC components - no orchestration needed
 */
export async function setupBitcoinComponents(config: ClaimConfig): Promise<BitcoinComponents> {
  if (!config.rpcUrl) {
    throw new Error('Core RPC URL is required. Use --core-rpc-url flag.');
  }

  if (!config.walletName) {
    throw new Error('Wallet name is required for mainnet/testnet. Use --wallet-name flag.');
  }

  const rpcClient = new BitcoinRpcClient(config.rpcUrl);
  
  const walletManager = new WalletManager(rpcClient, {
    walletName: config.walletName,
    walletPassphrase: config.walletPassphrase,
    createIfNotExists: false,  // Wallet must exist for mainnet/testnet
    fundWallet: false           // Never mine on mainnet/testnet
  });
  
  try {
    await walletManager.setupWallet();
    await walletManager.fundWallet(); // Just checks UTXOs for mainnet/testnet
  } catch (error) {
    throw new Error(`Failed to setup Bitcoin components for ${config.network}: ${error instanceof Error ? error.message : 'unknown'}`);
  }
  
  const transactionBuilder = new TransactionBuilder(rpcClient, walletManager, config.feeRate ?? 1);
  
  return { 
    rpcClient, 
    walletManager, 
    transactionBuilder
  };
}

/**
 * Setup regtest orchestrator for testing
 * Returns orchestrator with mining and test environment control
 */
export async function setupRegtestOrchestrator(config: ClaimConfig): Promise<RegtestOrchestrator> {
  if (!config.rpcUrl) {
    throw new Error('Core RPC URL is required. Use --core-rpc-url flag.');
  }

  const orchestrator = new RegtestOrchestrator({
    rpcUrl: config.rpcUrl,
    walletName: config.walletName,
    walletPassphrase: config.walletPassphrase,
    createWalletIfNotExists: true,
    fundWallet: true,
    autoMine: false,
    feeRate: config.feeRate ?? 1
  });

  try {
    await orchestrator.setup();
  } catch (error) {
    throw new Error(`Failed to setup regtest orchestrator: ${error instanceof Error ? error.message : 'unknown'}`);
  }

  return orchestrator;
}

/**
 * Load a BMP file and return its hex representation
 */
export function loadBMPFile(filePath: string): string {
  try {
    const bmpData = fs.readFileSync(filePath);
    return bmpData.toString('hex');
  } catch (error) {
    throw new Error(`Failed to load BMP file ${filePath}: ${error instanceof Error ? error.message : 'unknown'}`);
  }
}

/**
 * Print indexing instructions after creating claims
 */
export function printIndexingInstructions(tipHash: string, genesisHash: string, network: string = 'testnet'): void {
  console.log('\n📋 Next Steps:');
  console.log('  1. Run the indexer:');
  console.log(`     npm run indexer -- ${tipHash} ${genesisHash} --network ${network} --rpc-url <rpc-url>`);
  console.log('');
  console.log('  2. Start the web server:');
  console.log(`     npm run web -- --env=${network} --genesis-hash=${genesisHash} --port=3000`);
  console.log('');
  console.log('  3. View at: http://localhost:3000');
}
