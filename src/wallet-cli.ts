#!/usr/bin/env node
/**
 * UBB Wallet CLI
 * 
 * A command-line tool for creating Bitcoin wallets and UBB claim transactions.
 * Uses bitcore-lib for wallet management and transaction signing.
 */

import * as bitcore from 'bitcore-lib';
import * as fs from 'fs';
import * as path from 'path';
import { buildClaimOpReturnHex } from './transactions/build-claim-opreturn';

const WALLETS_DIR = path.join(process.cwd(), '.wallets');

interface WalletData {
  name: string;
  network: 'mainnet' | 'testnet';
  mnemonic?: string;
  hdPrivateKey: string;
  createdAt: string;
  addresses: {
    path: string;
    address: string;
    publicKey: string;
  }[];
}

/**
 * Ensures the wallets directory exists
 */
function ensureWalletsDir(): void {
  if (!fs.existsSync(WALLETS_DIR)) {
    fs.mkdirSync(WALLETS_DIR, { recursive: true });
  }
}

/**
 * Gets the path to a wallet file
 */
function getWalletPath(walletName: string): string {
  return path.join(WALLETS_DIR, `${walletName}.json`);
}

/**
 * Checks if a wallet exists
 */
function walletExists(walletName: string): boolean {
  return fs.existsSync(getWalletPath(walletName));
}

/**
 * Loads a wallet from disk
 */
function loadWallet(walletName: string): WalletData {
  const walletPath = getWalletPath(walletName);
  
  if (!fs.existsSync(walletPath)) {
    throw new Error(`Wallet '${walletName}' does not exist`);
  }
  
  const data = fs.readFileSync(walletPath, 'utf-8');
  return JSON.parse(data) as WalletData;
}

/**
 * Saves a wallet to disk
 */
function saveWallet(wallet: WalletData): void {
  ensureWalletsDir();
  const walletPath = getWalletPath(wallet.name);
  fs.writeFileSync(walletPath, JSON.stringify(wallet, null, 2), 'utf-8');
}

/**
 * Gets the bitcore Network for a given network name
 */
function getNetwork(networkName: 'mainnet' | 'testnet'): bitcore.Networks.Network {
  return networkName === 'testnet' 
    ? bitcore.Networks.testnet 
    : bitcore.Networks.livenet;
}

/**
 * Creates a new wallet
 */
function createWallet(walletName: string, network: 'mainnet' | 'testnet'): void {
  if (walletExists(walletName)) {
    console.error(`Error: Wallet '${walletName}' already exists`);
    process.exit(1);
  }

  // Generate a new HD private key
  const hdPrivateKey = new bitcore.HDPrivateKey(getNetwork(network));
  
  const wallet: WalletData = {
    name: walletName,
    network,
    hdPrivateKey: hdPrivateKey.toString(),
    createdAt: new Date().toISOString(),
    addresses: []
  };

  saveWallet(wallet);
  
  console.log(`Wallet '${walletName}' created successfully on ${network}`);
  console.log(`HD Private Key: ${hdPrivateKey.toString()}`);
  console.log(`\nWARNING: Keep your private key safe! Anyone with access to it can spend your funds.`);
  console.log(`Wallet saved to: ${getWalletPath(walletName)}`);
}

/**
 * Lists all wallets
 */
function listWallets(): void {
  ensureWalletsDir();
  
  const files = fs.readdirSync(WALLETS_DIR);
  const walletFiles = files.filter(f => f.endsWith('.json'));
  
  if (walletFiles.length === 0) {
    console.log('No wallets found');
    return;
  }
  
  console.log('Available wallets:');
  walletFiles.forEach(file => {
    const walletName = file.replace('.json', '');
    try {
      const wallet = loadWallet(walletName);
      console.log(`  - ${wallet.name} (${wallet.network}) - ${wallet.addresses.length} address(es)`);
    } catch (error) {
      console.log(`  - ${walletName} (error loading)`);
    }
  });
}

/**
 * Shows wallet information
 */
function showWallet(walletName: string): void {
  const wallet = loadWallet(walletName);
  
  console.log(`Wallet: ${wallet.name}`);
  console.log(`Network: ${wallet.network}`);
  console.log(`Created: ${wallet.createdAt}`);
  console.log(`HD Private Key: ${wallet.hdPrivateKey}`);
  console.log(`\nAddresses (${wallet.addresses.length}):`);
  
  wallet.addresses.forEach((addr, index) => {
    console.log(`  ${index + 1}. ${addr.address}`);
    console.log(`     Path: ${addr.path}`);
    console.log(`     Public Key: ${addr.publicKey}`);
  });
}

/**
 * Creates a new address for a wallet
 */
function createAddress(walletName: string): void {
  const wallet = loadWallet(walletName);
  
  // Derive next address using BIP44 path
  // m/44'/0'/0'/0/index (mainnet) or m/44'/1'/0'/0/index (testnet)
  const coinType = wallet.network === 'testnet' ? 1 : 0;
  const addressIndex = wallet.addresses.length;
  const derivationPath = `m/44'/${coinType}'/0'/0/${addressIndex}`;
  
  const hdPrivateKey = new bitcore.HDPrivateKey(wallet.hdPrivateKey);
  const derivedKey = hdPrivateKey.deriveChild(derivationPath);
  const address = derivedKey.privateKey.toAddress(getNetwork(wallet.network));
  
  wallet.addresses.push({
    path: derivationPath,
    address: address.toString(),
    publicKey: derivedKey.publicKey.toString()
  });
  
  saveWallet(wallet);
  
  console.log(`New address created for wallet '${walletName}':`);
  console.log(`Address: ${address.toString()}`);
  console.log(`Derivation Path: ${derivationPath}`);
}

/**
 * Lists addresses in a wallet
 */
function listAddresses(walletName: string): void {
  const wallet = loadWallet(walletName);
  
  if (wallet.addresses.length === 0) {
    console.log(`Wallet '${walletName}' has no addresses. Create one with: create-address`);
    return;
  }
  
  console.log(`Addresses for wallet '${walletName}':`);
  wallet.addresses.forEach((addr, index) => {
    console.log(`  ${index + 1}. ${addr.address} (${addr.path})`);
  });
}

/**
 * Gets transaction ID from hex
 */
function getTxId(txHex: string): void {
  try {
    // Remove whitespace and newlines
    const cleanHex = txHex.trim().replace(/\s+/g, '');
    
    // Parse the transaction
    const tx = new bitcore.Transaction(cleanHex);
    
    // Get the transaction ID
    const txid = tx.id;
    
    console.log(txid);
  } catch (error) {
    console.error('Error parsing transaction:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

/**
 * Creates a UBB claim transaction
 */
function createClaimTransaction(
  walletName: string,
  address: string,
  utxoTxId: string,
  utxoVout: number,
  utxoAmount: number,
  x: number,
  y: number,
  uri: string,
  bmpFilePath: string,
  outputFile?: string
): void {
  const wallet = loadWallet(walletName);
  
  if (wallet.addresses.length === 0) {
    console.error('Error: Wallet has no addresses. Create one first with create-address');
    process.exit(1);
  }
  
  // Find the address in the wallet
  const addressInfo = wallet.addresses.find(addr => addr.address === address);
  
  if (!addressInfo) {
    console.error(`Error: Address '${address}' not found in wallet '${walletName}'`);
    console.error(`\nAvailable addresses:`);
    wallet.addresses.forEach((addr, idx) => {
      console.error(`  ${idx + 1}. ${addr.address}`);
    });
    process.exit(1);
  }
  
  // Load BMP file
  if (!fs.existsSync(bmpFilePath)) {
    console.error(`Error: BMP file not found: ${bmpFilePath}`);
    process.exit(1);
  }
  
  const bmpBuffer = fs.readFileSync(bmpFilePath);
  const bmpHex = bmpBuffer.toString('hex');
  
  // Build the OP_RETURN payload
  const opReturnResult = buildClaimOpReturnHex(x, y, uri, bmpHex);
  
  if (!opReturnResult.ok) {
    console.error('Error building OP_RETURN payload:');
    if (opReturnResult.errors.x) {
      console.error('  X coordinate errors:', opReturnResult.errors.x);
    }
    if (opReturnResult.errors.y) {
      console.error('  Y coordinate errors:', opReturnResult.errors.y);
    }
    if (opReturnResult.errors.uri) {
      console.error('  URI errors:', opReturnResult.errors.uri);
    }
    if (opReturnResult.errors.bmp) {
      console.error('  BMP errors:', opReturnResult.errors.bmp);
    }
    process.exit(1);
  }
  
  const opReturnData = Buffer.from(opReturnResult.hex, 'hex');
  
  // Get the private key for signing
  const hdPrivateKey = new bitcore.HDPrivateKey(wallet.hdPrivateKey);
  const derivedKey = hdPrivateKey.deriveChild(addressInfo.path);
  const privateKey = derivedKey.privateKey;
  
  const network = getNetwork(wallet.network);
  
  // Create the transaction
  const tx = new bitcore.Transaction();
  
  // Add input UTXO
  tx.from({
    txId: utxoTxId,
    outputIndex: utxoVout,
    script: bitcore.Script.buildPublicKeyHashOut(addressInfo.address).toString(),
    satoshis: utxoAmount
  });
  
  // Add OP_RETURN output with UBB claim data
  const opReturnScript = bitcore.Script.buildDataOut(opReturnData);
  tx.addOutput(new bitcore.Transaction.Output({
    script: opReturnScript,
    satoshis: 0
  }));
  
  // Add deed output (600 satoshis)
  const deedScript = bitcore.Script.buildPublicKeyHashOut(addressInfo.address);
  tx.addOutput(new bitcore.Transaction.Output({
    script: deedScript,
    satoshis: 600
  }));
  
  // Add change output
  // Calculate fee: rough estimate based on transaction size
  // Typical size: ~300-500 bytes for simple tx, more for large OP_RETURN
  const estimatedSize = 200 + opReturnData.length; // Base size + OP_RETURN data
  const feeRate = 1; // satoshis per byte (very conservative, can be adjusted)
  const estimatedFee = estimatedSize * feeRate;
  const changeAmount = utxoAmount - 600 - estimatedFee;
  
  if (changeAmount < 0) {
    console.error(`Error: Insufficient funds. Need at least ${600 + estimatedFee} satoshis, but only have ${utxoAmount}`);
    process.exit(1);
  }
  
  if (changeAmount >= 546) { // Dust limit
    const changeScript = bitcore.Script.buildPublicKeyHashOut(addressInfo.address);
    tx.addOutput(new bitcore.Transaction.Output({
      script: changeScript,
      satoshis: changeAmount
    }));
  }
  
  // Sign the transaction
  tx.sign(privateKey);
  
  // Get the transaction hex
  // Use serialize(true) to skip checks (bitcore-lib validates dust amounts)
  // OP_RETURN outputs with 0 satoshis are valid but trigger dust warnings
  const txHex = tx.serialize(true);
  
  // If output file specified, write just the hex
  if (outputFile) {
    fs.writeFileSync(outputFile, txHex + '\n', 'utf-8');
    console.log(`Transaction hex written to: ${outputFile}`);
  } else {
    // Default verbose output
    console.log('\n=== UBB Claim Transaction Created ===');
    console.log(`Wallet: ${walletName}`);
    console.log(`Network: ${wallet.network}`);
    console.log(`From Address: ${addressInfo.address}`);
    console.log(`Coordinates: (${x}, ${y})`);
    console.log(`URI: ${uri || '(empty)'}`);
    console.log(`BMP File: ${bmpFilePath}`);
    console.log(`BMP Size: ${bmpBuffer.length} bytes`);
    console.log(`Input UTXO: ${utxoTxId}:${utxoVout} (${utxoAmount} satoshis)`);
    console.log(`Deed Output: 600 satoshis`);
    console.log(`Change Output: ${changeAmount} satoshis`);
    console.log(`Estimated Fee: ${estimatedFee} satoshis`);
    console.log(`Transaction Size: ~${txHex.length / 2} bytes`);
    console.log(`\nSigned Transaction Hex:`);
    console.log(txHex);
    console.log(`\nYou can broadcast this transaction using: bitcoin-cli sendrawtransaction ${txHex}`);
  }
}

/**
 * Shows usage information
 */
function showUsage(): void {
  console.log(`
UBB Wallet CLI - Bitcoin Wallet and UBB Claim Transaction Tool

USAGE:
  wallet-cli <command> [options]

COMMANDS:
  create-wallet <name> <network>
      Create a new wallet
      - name: Wallet name (e.g., "my-wallet")
      - network: "mainnet" or "testnet"

  list-wallets
      List all available wallets

  show-wallet <name>
      Show detailed wallet information

  create-address <wallet-name>
      Create a new address for a wallet

  list-addresses <wallet-name>
      List all addresses in a wallet

  get-txid <tx-hex>
      Get transaction ID from transaction hex
      - tx-hex: Raw transaction hex string (or use --file to read from file)
      Options:
        --file <path>: Read hex from file instead of command line

  make-claim <wallet-name> <address> <utxo-txid> <utxo-vout> <utxo-amount> <x> <y> <uri> <bmp-file> [--output <file>]
      Create a UBB claim transaction
      - wallet-name: Name of the wallet to use
      - address: Address from the wallet to use (e.g., tb1q... or 1A1z...)
      - utxo-txid: Transaction ID of the UTXO to spend
      - utxo-vout: Output index of the UTXO
      - utxo-amount: Amount of the UTXO in satoshis
      - x: X coordinate (0-65534)
      - y: Y coordinate (0-65534)
      - uri: URI string (use "" for empty)
      - bmp-file: Path to BMP file
      - --output <file>: Optional. Write transaction hex to file (single line, hex only)

EXAMPLES:
  # Create a testnet wallet
  wallet-cli create-wallet my-wallet testnet

  # Create a new address
  wallet-cli create-address my-wallet

  # Create a claim transaction
  wallet-cli make-claim my-wallet tb1q5xwj... abc123... 0 100000 100 200 "https://example.com" image.bmp
  
  # Create a claim transaction and save to file
  wallet-cli make-claim my-wallet tb1q5xwj... abc123... 0 100000 100 200 "https://example.com" image.bmp --output tx.hex
  
  # Get transaction ID from hex
  wallet-cli get-txid 01000000...
  
  # Get transaction ID from file
  wallet-cli get-txid --file tx.hex

NOTES:
  - Wallets are stored in ${WALLETS_DIR}
  - Keep your wallet files safe - they contain private keys!
  - No password protection - ensure file system security
`);
}

/**
 * Main CLI entry point
 */
function main(): void {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showUsage();
    process.exit(0);
  }
  
  const command = args[0];
  
  try {
    switch (command) {
      case 'create-wallet':
        if (args.length !== 3) {
          console.error('Error: create-wallet requires <name> and <network>');
          process.exit(1);
        }
        const network = args[2] as 'mainnet' | 'testnet';
        if (network !== 'mainnet' && network !== 'testnet') {
          console.error('Error: network must be "mainnet" or "testnet"');
          process.exit(1);
        }
        createWallet(args[1], network);
        break;
        
      case 'list-wallets':
        listWallets();
        break;
        
      case 'show-wallet':
        if (args.length !== 2) {
          console.error('Error: show-wallet requires <name>');
          process.exit(1);
        }
        showWallet(args[1]);
        break;
        
      case 'create-address':
        if (args.length !== 2) {
          console.error('Error: create-address requires <wallet-name>');
          process.exit(1);
        }
        createAddress(args[1]);
        break;
        
      case 'list-addresses':
        if (args.length !== 2) {
          console.error('Error: list-addresses requires <wallet-name>');
          process.exit(1);
        }
        listAddresses(args[1]);
        break;
        
      case 'get-txid':
        {
          // Check for --file flag
          const fileIndex = args.indexOf('--file');
          let txHex: string;
          
          if (fileIndex !== -1 && args[fileIndex + 1]) {
            // Read from file
            const filePath = args[fileIndex + 1];
            if (!fs.existsSync(filePath)) {
              console.error(`Error: File not found: ${filePath}`);
              process.exit(1);
            }
            txHex = fs.readFileSync(filePath, 'utf-8');
          } else {
            // Read from command line argument
            if (args.length < 2) {
              console.error('Error: get-txid requires <tx-hex> or --file <path>');
              process.exit(1);
            }
            txHex = args[1];
          }
          
          getTxId(txHex);
        }
        break;
        
      case 'make-claim':
        if (args.length < 10) {
          console.error('Error: make-claim requires at least 9 arguments');
          console.error('Usage: make-claim <wallet-name> <address> <utxo-txid> <utxo-vout> <utxo-amount> <x> <y> <uri> <bmp-file> [--output <file>]');
          process.exit(1);
        }
        
        // Check for --output flag
        let outputFile: string | undefined;
        const outputIndex = args.indexOf('--output');
        if (outputIndex !== -1 && args[outputIndex + 1]) {
          outputFile = args[outputIndex + 1];
        }
        
        createClaimTransaction(
          args[1],
          args[2],
          args[3],
          parseInt(args[4]),
          parseInt(args[5]),
          parseInt(args[6]),
          parseInt(args[7]),
          args[8],
          args[9],
          outputFile
        );
        break;
        
      case 'help':
      case '--help':
      case '-h':
        showUsage();
        break;
        
      default:
        console.error(`Error: Unknown command '${command}'`);
        showUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// Run the CLI
main();

