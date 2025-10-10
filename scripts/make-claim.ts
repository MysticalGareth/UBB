/**
 * Make Claim Script
 * 
 * Creates a single CLAIM transaction on any Bitcoin network (mainnet, testnet, or regtest)
 * 
 * Usage:
 *   npm run make-claim -- --x <x> --y <y> --image <path> --core-rpc-url <url> --wallet-name <name> [options]
 * 
 * Required Options:
 *   --x <number>             X coordinate (0-65535)
 *   --y <number>             Y coordinate (0-65535)
 *   --image <path>           Path to BMP image file
 *   --core-rpc-url <url>     Bitcoin Core RPC URL (e.g., http://user:pass@127.0.0.1:8332)
 *   --wallet-name <name>     Bitcoin Core wallet name
 * 
 * Optional:
 *   --uri <uri>              URI metadata for the plot
 *   --network <network>      Network: mainnet, testnet, or regtest (default: mainnet)
 *   --wallet-passphrase <pw> Wallet passphrase for encrypted wallets
 *   --fee-rate <rate>        Fee rate in sat/vByte (default: 1, accepts decimals like 1.5)
 *   --no-broadcast           Build transaction without broadcasting (returns hex)
 * 
 * Examples:
 *   # Mainnet
 *   npm run make-claim -- \
 *     --x 100 --y 200 \
 *     --uri https://example.com/plot \
 *     --image tests/fixtures/bitcoin_uncompressed_24.bmp \
 *     --core-rpc-url http://user:password@127.0.0.1:8332 \
 *     --wallet-name my_wallet
 * 
 *   # With encrypted wallet
 *   npm run make-claim -- \
 *     --x 100 --y 200 \
 *     --uri https://example.com/plot \
 *     --image tests/fixtures/bitcoin_uncompressed_24.bmp \
 *     --core-rpc-url http://user:password@127.0.0.1:8332 \
 *     --wallet-name my_wallet \
 *     --wallet-passphrase "my secure passphrase"
 * 
 *   # Regtest (for testing)
 *   npm run make-claim -- \
 *     --x 100 --y 200 \
 *     --uri https://example.com/plot \
 *     --image tests/fixtures/bitcoin_uncompressed_24.bmp \
 *     --core-rpc-url http://user:password@127.0.0.1:18443 \
 *     --wallet-name test_wallet \
 *     --network regtest
 * 
 *   # With custom fee rate (10.5 sat/vByte)
 *   npm run make-claim -- \
 *     --x 100 --y 200 \
 *     --uri https://example.com/plot \
 *     --image tests/fixtures/bitcoin_uncompressed_24.bmp \
 *     --core-rpc-url http://user:password@127.0.0.1:8332 \
 *     --wallet-name my_wallet \
 *     --fee-rate 10.5
 */

import * as path from 'path';
import {
  setupOrchestrator,
  loadBMPFile,
  createClaim,
  mineBlock,
  getTipHash,
  getGenesisHash,
  printIndexingInstructions
} from './claim-utils';

interface ParsedArgs {
  x?: number;
  y?: number;
  imagePath?: string;
  uri?: string;
  network: 'regtest' | 'mainnet' | 'testnet';
  walletName?: string;
  walletPassphrase?: string;
  rpcUrl?: string;
  noBroadcast?: boolean;
  feeRate?: number;
  recipientAddress?: string;
}

function printUsage() {
  console.error('❌ Usage: npm run make-claim -- --x <x> --y <y> --image <path> --core-rpc-url <url> --wallet-name <name> [options]');
  console.error('');
  console.error('Required Options:');
  console.error('  --x <number>             X coordinate (0-65535)');
  console.error('  --y <number>             Y coordinate (0-65535)');
  console.error('  --image <path>           Path to BMP image file');
  console.error('  --core-rpc-url <url>     Bitcoin Core RPC URL');
  console.error('  --wallet-name <name>     Bitcoin Core wallet name');
  console.error('');
  console.error('Optional:');
  console.error('  --uri <uri>              URI metadata for the plot');
  console.error('  --network <network>      Network: mainnet, testnet, or regtest (default: mainnet)');
  console.error('  --wallet-passphrase <pw> Wallet passphrase for encrypted wallets');
  console.error('  --fee-rate <rate>        Fee rate in sat/vByte (default: 1, accepts decimals like 1.5)');
  console.error('  --recipient-address <addr> Address for the deed output (default: generate new address)');
  console.error('  --no-broadcast           Build transaction without broadcasting (returns hex)');
  console.error('');
  console.error('Examples:');
  console.error('  npm run make-claim -- --x 100 --y 200 --uri https://example.com --image bitcoin.bmp --core-rpc-url http://user:pass@127.0.0.1:8332 --wallet-name my_wallet');
  console.error('  npm run make-claim -- --x 100 --y 200 --uri https://example.com --image bitcoin.bmp --core-rpc-url http://user:pass@127.0.0.1:8332 --wallet-name my_wallet --network testnet');
}

function parseArguments(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    network: 'mainnet'
  };

  // Parse all flags
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--x' && i + 1 < args.length) {
      parsed.x = parseInt(args[++i]);
    } else if (arg === '--y' && i + 1 < args.length) {
      parsed.y = parseInt(args[++i]);
    } else if (arg === '--image' && i + 1 < args.length) {
      parsed.imagePath = args[++i];
    } else if (arg === '--uri' && i + 1 < args.length) {
      parsed.uri = args[++i];
    } else if (arg === '--network' && i + 1 < args.length) {
      const network = args[++i];
      if (network !== 'regtest' && network !== 'mainnet' && network !== 'testnet') {
        console.error('❌ Error: network must be regtest, testnet, or mainnet');
        process.exit(1);
      }
      parsed.network = network;
    } else if (arg === '--wallet-name' && i + 1 < args.length) {
      parsed.walletName = args[++i];
    } else if (arg === '--wallet-passphrase' && i + 1 < args.length) {
      parsed.walletPassphrase = args[++i];
    } else if (arg === '--core-rpc-url' && i + 1 < args.length) {
      parsed.rpcUrl = args[++i];
    } else if (arg === '--fee-rate' && i + 1 < args.length) {
      parsed.feeRate = parseFloat(args[++i]);
    } else if (arg === '--recipient-address' && i + 1 < args.length) {
      parsed.recipientAddress = args[++i];
    } else if (arg === '--no-broadcast') {
      parsed.noBroadcast = true;
    }
  }

  // Validate required arguments
  const missing: string[] = [];
  if (parsed.x === undefined) missing.push('--x');
  if (parsed.y === undefined) missing.push('--y');
  if (!parsed.imagePath) missing.push('--image');
  if (!parsed.rpcUrl) missing.push('--core-rpc-url');
  if (!parsed.walletName) missing.push('--wallet-name');

  if (missing.length > 0) {
    console.error(`❌ Missing required arguments: ${missing.join(', ')}\n`);
    printUsage();
    process.exit(1);
  }

  // Validate fee rate if provided
  if (parsed.feeRate !== undefined) {
    if (isNaN(parsed.feeRate) || parsed.feeRate <= 0 || !isFinite(parsed.feeRate)) {
      console.error('❌ Error: fee-rate must be a positive number');
      process.exit(1);
    }
  }

  return parsed;
}

async function main() {
  // Parse arguments
  const args = parseArguments(process.argv.slice(2));
  
  const { x, y, imagePath, uri, network, walletName, walletPassphrase, rpcUrl, noBroadcast, feeRate, recipientAddress } = args;

  // Validate coordinates (already checked for undefined in parseArguments)
  if (isNaN(x!) || isNaN(y!)) {
    console.error('❌ Error: x and y must be valid numbers');
    process.exit(1);
  }

  if (x! < 0 || x! > 65535 || y! < 0 || y! > 65535) {
    console.error('❌ Error: x and y must be between 0 and 65535');
    process.exit(1);
  }

  // Resolve image path (support both absolute and relative paths)
  const resolvedImagePath = path.isAbsolute(imagePath!) 
    ? imagePath! 
    : path.join(process.cwd(), imagePath!);

  console.log('🎨 UBB Create Claim Script');
  console.log('');
  console.log(`Network: ${network}`);
  console.log(`Position: (${x}, ${y})`);
  console.log(`Image: ${resolvedImagePath}`);
  console.log(`Core RPC URL: ${rpcUrl}`);
  console.log(`Wallet: ${walletName}`);
  if (uri) {
    console.log(`URI: ${uri}`);
  }
  if (recipientAddress) {
    console.log(`Recipient Address: ${recipientAddress}`);
  }
  if (walletPassphrase) {
    console.log(`Encrypted: Yes (will unlock)`);
  }
  console.log('');

  // Load BMP
  let bmpHex: string;
  try {
    bmpHex = loadBMPFile(resolvedImagePath);
    console.log(`✅ Loaded BMP file (${bmpHex.length / 2} bytes)\n`);
  } catch (error) {
    console.error('❌', error instanceof Error ? error.message : 'Failed to load BMP');
    process.exit(1);
  }

  // Setup orchestrator
  console.log(`🔧 Setting up ${network} orchestrator...`);
  const orchestrator = await setupOrchestrator({
    network,
    blockSource: 'rpc',
    rpcUrl,
    walletName,
    walletPassphrase,
    feeRate
  });
  console.log(`✅ ${network} orchestrator ready\n`);

  // Create CLAIM transaction
  try {
    if (noBroadcast) {
      console.log('📝 Building CLAIM transaction (not broadcasting)...');
    } else {
      console.log('📝 Creating CLAIM transaction...');
    }
    
    const result = await createClaim(orchestrator, x!, y!, bmpHex, uri, !noBroadcast, recipientAddress);
    
    if (noBroadcast) {
      console.log(`✅ CLAIM transaction built:`);
      console.log(`   Transaction ID: ${result.txid}`);
      console.log(`   Deed UTXO: ${result.deedUTXO}`);
      console.log('');
      console.log('📄 Transaction Hex:');
      console.log(result.hex);
      console.log('');
      console.log('💡 To broadcast this transaction:');
      console.log(`   bitcoin-cli sendrawtransaction ${result.hex}`);
    } else {
      console.log(`✅ CLAIM created:`);
      console.log(`   Transaction ID: ${result.txid}`);
      console.log(`   Deed UTXO: ${result.deedUTXO}`);
    }
    console.log('');
  } catch (error) {
    console.error('❌ Failed to create CLAIM:', error instanceof Error ? error.message : 'unknown');
    await orchestrator.cleanup();
    process.exit(1);
  }

  // Mine block (regtest only, and only if transaction was broadcast)
  if (network === 'regtest' && !noBroadcast) {
    try {
      console.log('⛏️  Mining block...');
      const blockHash = await mineBlock(orchestrator);
      console.log(`✅ Block mined: ${blockHash}`);
      console.log('');
    } catch (error) {
      console.error('❌ Failed to mine block:', error);
      await orchestrator.cleanup();
      process.exit(1);
    }

    // Get hashes for indexing instructions (regtest only)
    const tipHash = await getTipHash(orchestrator);
    const genesisHash = await getGenesisHash(orchestrator);

    // Print instructions
    printIndexingInstructions(tipHash, genesisHash, network);
  } else if (!noBroadcast) {
    // Only print these instructions if transaction was broadcast
    console.log('');
    console.log('📋 Next Steps:');
    console.log('  1. Wait for transaction to be confirmed in a block');
    console.log('  2. Run the indexer to track the claim:');
    console.log(`     npm run indexer -- <tip-hash> <genesis-hash> --network ${network} --block-source rpc`);
    console.log('');
  }

  await orchestrator.cleanup();
}

main().catch(console.error);
