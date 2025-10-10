/**
 * Make Transfer Script
 * 
 * Creates a TRANSFER transaction to transfer ownership of a plot to a new address
 * 
 * Usage:
 *   npm run make-transfer -- --deed-utxo <txid:vout> --recipient-address <address> --core-rpc-url <url> --wallet-name <name> [options]
 * 
 * Required Options:
 *   --deed-utxo <txid:vout>      Current deed UTXO (format: txid:vout)
 *   --recipient-address <address> Destination address for the new deed UTXO (new owner's address)
 *   --core-rpc-url <url>         Bitcoin Core RPC URL (e.g., http://user:pass@127.0.0.1:8332)
 *   --wallet-name <name>         Bitcoin Core wallet name
 * 
 * Optional:
 *   --network <network>      Network: mainnet, testnet, or regtest (default: mainnet)
 *   --wallet-passphrase <pw> Wallet passphrase for encrypted wallets
 *   --fee-rate <rate>        Fee rate in sat/vByte (default: 1, accepts decimals like 1.5)
 * 
 * Examples:
 *   # Mainnet - transfer plot to new owner
 *   npm run make-transfer -- \
 *     --deed-utxo abc123...:1 \
 *     --recipient-address bc1q... \
 *     --core-rpc-url http://user:password@127.0.0.1:8332 \
 *     --wallet-name my_wallet
 * 
 *   # With encrypted wallet
 *   npm run make-transfer -- \
 *     --deed-utxo abc123...:1 \
 *     --recipient-address bc1q... \
 *     --core-rpc-url http://user:password@127.0.0.1:8332 \
 *     --wallet-name my_wallet \
 *     --wallet-passphrase "my secure passphrase"
 * 
 *   # Regtest (for testing)
 *   npm run make-transfer -- \
 *     --deed-utxo abc123...:1 \
 *     --recipient-address bcrt1q... \
 *     --core-rpc-url http://user:password@127.0.0.1:18443 \
 *     --wallet-name test_wallet \
 *     --network regtest
 * 
 *   # With custom fee rate (15 sat/vByte)
 *   npm run make-transfer -- \
 *     --deed-utxo abc123...:1 \
 *     --recipient-address bc1q... \
 *     --core-rpc-url http://user:password@127.0.0.1:8332 \
 *     --wallet-name my_wallet \
 *     --fee-rate 15
 */

import {
  setupBitcoinClient,
  setupRegtestOrchestrator,
  mineBlock,
  getTipHash,
  getGenesisHash,
  printIndexingInstructions
} from './claim-utils';

interface ParsedArgs {
  deedUTXO?: string;
  recipientAddress?: string;
  network: 'regtest' | 'mainnet' | 'testnet';
  walletName?: string;
  walletPassphrase?: string;
  rpcUrl?: string;
  feeRate?: number;
}

function printUsage() {
  console.error('❌ Usage: npm run make-transfer -- --deed-utxo <txid:vout> --recipient-address <address> --core-rpc-url <url> --wallet-name <name> [options]');
  console.error('');
  console.error('Required Options:');
  console.error('  --deed-utxo <txid:vout>      Current deed UTXO (format: txid:vout)');
  console.error('  --recipient-address <address> Destination address for the new deed UTXO (new owner\'s address)');
  console.error('  --core-rpc-url <url>         Bitcoin Core RPC URL');
  console.error('  --wallet-name <name>         Bitcoin Core wallet name');
  console.error('');
  console.error('Optional:');
  console.error('  --network <network>      Network: mainnet, testnet, or regtest (default: mainnet)');
  console.error('  --wallet-passphrase <pw> Wallet passphrase for encrypted wallets');
  console.error('  --fee-rate <rate>        Fee rate in sat/vByte (default: 1, accepts decimals like 1.5)');
  console.error('');
  console.error('Examples:');
  console.error('  npm run make-transfer -- --deed-utxo abc123...:1 --recipient-address bc1q... --core-rpc-url http://user:pass@127.0.0.1:8332 --wallet-name my_wallet');
}

function parseArguments(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    network: 'mainnet'
  };

  // Parse all flags
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--deed-utxo' && i + 1 < args.length) {
      parsed.deedUTXO = args[++i];
    } else if (arg === '--recipient-address' && i + 1 < args.length) {
      parsed.recipientAddress = args[++i];
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
    }
  }

  // Validate required arguments
  const missing: string[] = [];
  if (!parsed.deedUTXO) missing.push('--deed-utxo');
  if (!parsed.recipientAddress) missing.push('--recipient-address');
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
  
  const { deedUTXO, recipientAddress, network, walletName, walletPassphrase, rpcUrl, feeRate } = args;

  // Validate deed UTXO format
  const deedParts = deedUTXO!.split(':');
  if (deedParts.length !== 2 || deedParts[0].length !== 64 || isNaN(parseInt(deedParts[1]))) {
    console.error('❌ Error: deed-utxo must be in format txid:vout (e.g., abc123...:1)');
    console.error(`   Provided: ${deedUTXO}`);
    process.exit(1);
  }

  console.log('🔄 UBB Make Transfer Script');
  console.log('');
  console.log(`Network: ${network}`);
  console.log(`Deed UTXO: ${deedUTXO}`);
  console.log(`Recipient Address: ${recipientAddress}`);
  console.log(`Core RPC URL: ${rpcUrl}`);
  console.log(`Wallet: ${walletName}`);
  if (walletPassphrase) {
    console.log(`Encrypted: Yes (will unlock)`);
  }
  console.log('');

  // Parse deed UTXO into txid and vout
  const [txid, voutStr] = deedUTXO!.split(':');
  const vout = parseInt(voutStr, 10);
  const deedInput = { txid, vout, amount: 0.000006 }; // 600 sats

  if (network === 'regtest') {
    // Regtest: Use orchestrator for test convenience
    console.log(`🔧 Setting up regtest orchestrator...`);
    const orchestrator = await setupRegtestOrchestrator({
      network,
      blockSource: 'rpc',
      rpcUrl,
      walletName,
      walletPassphrase,
      feeRate
    });
    console.log(`✅ Regtest orchestrator ready\n`);

    try {
      console.log('📝 Creating TRANSFER transaction...');
      const result = await orchestrator.createTransferTx(deedUTXO!, recipientAddress!);
      
      console.log(`✅ TRANSFER created:`);
      console.log(`   Transaction ID: ${result.txid}`);
      console.log(`   New Deed UTXO: ${result.deedUTXO}`);
      console.log(`   Plot ownership transferred to: ${recipientAddress}`);
      console.log('');

      // Mine block
      console.log('⛏️  Mining block...');
      const blockHash = await mineBlock(orchestrator);
      console.log(`✅ Block mined: ${blockHash}`);
      console.log('');

      // Get hashes for indexing instructions
      const tipHash = await getTipHash(orchestrator);
      const genesisHash = await getGenesisHash(orchestrator);
      printIndexingInstructions(tipHash, genesisHash, network);

      await orchestrator.cleanup();
    } catch (error) {
      console.error('❌ Failed to create TRANSFER:', error instanceof Error ? error.message : 'unknown');
      await orchestrator.cleanup();
      process.exit(1);
    }
  } else {
    // Mainnet/Testnet: Use core components directly
    console.log(`🔧 Setting up Bitcoin client...`);
    const client = await setupBitcoinClient({
      network,
      blockSource: 'rpc',
      rpcUrl,
      walletName,
      walletPassphrase,
      feeRate
    });
    console.log(`✅ Bitcoin client ready\n`);

    try {
      console.log('📝 Creating TRANSFER transaction...');
      const result = await client.transactionBuilder.buildTransferTransaction(
        deedInput,
        undefined,      // changeAddress - auto-generate
        recipientAddress // deedAddress - recipient
      );
      
      console.log(`✅ TRANSFER created:`);
      console.log(`   Transaction ID: ${result.txid}`);
      console.log(`   New Deed UTXO: ${result.deedUTXO}`);
      console.log(`   Plot ownership transferred to: ${recipientAddress}`);
      console.log('');
      console.log('📋 Next Steps:');
      console.log('  1. Wait for transaction to be confirmed in a block');
      console.log('  2. Run the indexer to track the transfer:');
      console.log(`     npm run indexer -- <tip-hash> <genesis-hash> --network ${network} --block-source rpc`);
      console.log('');
    } catch (error) {
      console.error('❌ Failed to create TRANSFER:', error instanceof Error ? error.message : 'unknown');
      process.exit(1);
    }
  }
}

main().catch(console.error);
