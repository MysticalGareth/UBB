#!/usr/bin/env node

/**
 * UBB Indexer CLI
 * 
 * Usage: ubb-indexer [options]
 */

import { UBBIndexer } from './ubb-indexer';
import { logInfo } from './logger';
import { IndexerConfig } from './types';

// Hardcoded genesis hashes for known networks
const MAINNET_GENESIS = '000000000000000000010fa5bf8de1bff433e934e03ed671186592c8c3560f6e';

interface CLIOptions {
  dataDir: string;
  maxRetries: number;
  retryDelay: number;
  network: 'mainnet' | 'testnet' | 'regtest';
  rpcUrl: string;
  help: boolean;
  genesisFromHeight0: boolean;
}

function parseArgs(args: string[]): { tipHash: string; ubbGenesisHash: string; options: CLIOptions } {
  const options: CLIOptions = {
    dataDir: './data',
    maxRetries: 3,
    retryDelay: 1000,
    network: 'mainnet',
    rpcUrl: 'http://user:password@127.0.0.1:8332', // Default to mainnet port
    help: false,
    genesisFromHeight0: false
  };

  let tipHash = '';
  let ubbGenesisHash = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Skip the -- separator
    if (arg === '--') {
      continue;
    }

    switch (arg) {
      case '--data-dir':
        options.dataDir = args[++i];
        break;
      case '--max-retries':
        options.maxRetries = parseInt(args[++i], 10);
        break;
      case '--retry-delay':
        options.retryDelay = parseInt(args[++i], 10);
        break;
      case '--rpc-url':
        options.rpcUrl = args[++i];
        break;
      case '--network':
        const network = args[++i];
        if (network === 'mainnet' || network === 'testnet' || network === 'regtest') {
          options.network = network;
        } else {
          console.error(`Invalid network: ${network}. Must be 'mainnet', 'testnet', or 'regtest'`);
          process.exit(1);
        }
        break;
      case '--genesis-from-height-0':
        options.genesisFromHeight0 = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        } else if (!tipHash) {
          tipHash = arg;
        } else if (!ubbGenesisHash) {
          ubbGenesisHash = arg;
        } else {
          console.error(`Unexpected argument: ${arg}`);
          process.exit(1);
        }
        break;
    }
  }

  // Fix: If only one positional arg was provided, treat it as genesis hash, not tip
  if (tipHash && !ubbGenesisHash) {
    ubbGenesisHash = tipHash;
    tipHash = '';
  }

  return { tipHash, ubbGenesisHash, options };
}

function printHelp(): void {
  console.log(`
UBB Indexer - Unstoppable Bitcoin Billboard Blockchain Indexer

USAGE:
  ubb-indexer [options]
  ubb-indexer [<ubb-genesis-hash>] [options]
  ubb-indexer <tip-hash> <ubb-genesis-hash> [options]

ARGUMENTS:
  ubb-genesis-hash  The block hash where UBB protocol begins (first UBB transaction)
                    For mainnet, uses hardcoded genesis if not provided
  tip-hash          (Optional) The blockchain tip block hash to index to
                    If not provided, automatically fetches current tip from block source

OPTIONS:
  --data-dir <dir>              Data directory for storing states and images (default: ./data)
  --max-retries <number>        Maximum number of retries for failed requests (default: 3)
  --retry-delay <ms>            Delay between retries in milliseconds (default: 1000)
  --network <network>           Bitcoin network: 'mainnet', 'testnet', or 'regtest' (default: mainnet)
  --rpc-url <url>               Bitcoin Core RPC URL (required, default: http://user:password@127.0.0.1:8332)
  --genesis-from-height-0       Use block height 0 (chain genesis) as UBB genesis block
  --help, -h                    Show this help message

EXAMPLES:
  # Simplest usage - mainnet (uses hardcoded genesis, auto-fetches tip)
  ubb-indexer --rpc-url http://user:pass@127.0.0.1:8332

  # Same but with custom data directory
  ubb-indexer --rpc-url http://user:pass@127.0.0.1:8332 --data-dir /path/to/data

  # Testnet - genesis hash required
  ubb-indexer <testnet-genesis-hash> --network testnet --rpc-url http://user:pass@127.0.0.1:18332

  # Regtest example
  ubb-indexer <regtest-genesis-hash> --network regtest --rpc-url http://user:pass@127.0.0.1:18443

  # Specify explicit tip hash
  ubb-indexer 0000000000000000000123456789abcdef... 0000000000000000000987654321fedcba... --rpc-url http://user:pass@127.0.0.1:8332

DESCRIPTION:
  The UBB Indexer processes Bitcoin blockchain data to build and maintain the UBB
  (Unstoppable Bitcoin Billboard) state database. It implements a two-phase process:

  Phase 1: Walks backwards from the chain tip to find the most recent processed
  UBB state and builds a route back to the tip.

  Phase 2: Processes all blocks from the found state up to the chain tip,
  building UBB states and tracking plot placements, updates, and transfers.

  The indexer stores:
  - UBB state snapshots at each block in /data/{network}/v1/states/
  - BMP image files in /data/{network}/v1/images/
  - Raw blockchain data in /data/{network}/rawblock/
  - A symlink to the current tip state at /data/{network}/v1/state_at_tip

  For more information about the UBB protocol, see the README.md file.
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let { tipHash, ubbGenesisHash, options } = parseArgs(args);

  if (options.help) {
    printHelp();
    return;
  }

  // Handle genesis hash - use hardcoded value for mainnet if not provided
  if (options.genesisFromHeight0) {
    if (ubbGenesisHash) {
      console.error('Error: Cannot specify both --genesis-from-height-0 and a genesis hash');
      process.exit(1);
    }
    // Will be fetched below
  } else if (!ubbGenesisHash) {
    // Use hardcoded genesis for mainnet
    if (options.network === 'mainnet') {
      ubbGenesisHash = MAINNET_GENESIS;
      logInfo(`Using hardcoded mainnet genesis: ${ubbGenesisHash}`);
    } else {
      console.error('Error: ubb-genesis-hash is required for testnet/regtest (or use --genesis-from-height-0)');
      console.error('Use --help for usage information');
      process.exit(1);
    }
  }

  // Validate hash formats (basic check)
  if (tipHash && !/^[a-fA-F0-9]{64}$/.test(tipHash)) {
    console.error('Error: tip-hash must be a 64-character hexadecimal string');
    process.exit(1);
  }

  if (ubbGenesisHash && !/^[a-fA-F0-9]{64}$/.test(ubbGenesisHash)) {
    console.error('Error: ubb-genesis-hash must be a 64-character hexadecimal string');
    process.exit(1);
  }

  const config: IndexerConfig = {
    dataDir: options.dataDir,
    maxRetries: options.maxRetries,
    retryDelay: options.retryDelay,
    network: options.network,
    rpcUrl: options.rpcUrl
  };

  const indexer = new UBBIndexer(config);

  // Fetch genesis from height 0 if requested
  if (options.genesisFromHeight0) {
    logInfo('Fetching block hash at height 0 (chain genesis)...');
    try {
      ubbGenesisHash = await indexer.getBlockHashAtHeight(0);
      logInfo(`Fetched genesis block hash: ${ubbGenesisHash}`);
    } catch (error) {
      console.error(`Failed to fetch genesis block: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  // Fetch tip if not provided
  if (!tipHash) {
    logInfo('No tip hash provided, fetching current chain tip...');
    try {
      tipHash = await indexer.getTipHash();
      logInfo(`Fetched chain tip: ${tipHash}`);
    } catch (error) {
      console.error(`Failed to fetch chain tip: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  }

  logInfo('UBB Indexer starting...');
  logInfo(`Tip hash: ${tipHash}`);
  logInfo(`UBB genesis hash: ${ubbGenesisHash}`);
  logInfo(`Data directory: ${options.dataDir}/${options.network}`);
  logInfo(`Network: ${options.network}`);
  logInfo(`RPC URL: ${options.rpcUrl}`);

  try {
    const result = await indexer.index(tipHash, ubbGenesisHash);
    
    if (result.success) {
      console.log('\n✅ Indexing completed successfully!');
      console.log(`📊 Statistics:`);
      console.log(`   Blocks processed: ${result.blocksProcessed}`);
      console.log(`   Transactions processed: ${result.transactionsProcessed}`);
      console.log(`   Plots created: ${result.plotsCreated}`);
      console.log(`   Plots updated: ${result.plotsUpdated}`);
      console.log(`   Plots bricked: ${result.plotsBricked}`);
      
      if (result.errors.length > 0) {
        console.log(`\n⚠️  Warnings (${result.errors.length}):`);
        result.errors.forEach(error => console.log(`   ${error}`));
      }
    } else {
      console.error('\n❌ Indexing failed!');
      if (result.errors.length > 0) {
        console.error('Errors:');
        result.errors.forEach(error => console.error(`  ${error}`));
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('\n💥 Fatal error during indexing:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main, printHelp };
