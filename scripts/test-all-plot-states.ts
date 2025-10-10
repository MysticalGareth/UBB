/**
 * Test All Plot States Script
 * 
 * Creates transactions to test all possible plot states:
 * - PLACED: Valid claims that don't overlap
 * - UNPLACED: Claims that overlap with existing plots
 * - BRICKED: Plots where the deed UTXO is spent incorrectly
 * - UPDATED: Plots that have been updated
 * - TRANSFERRED: Plots that have been transferred to new owners
 * 
 * Usage:
 *   npm run test-states -- --core-rpc-url <url> --wallet-name <name>
 */

import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const REAL_BMP_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'bitcoin_uncompressed_24.bmp');
const SMALL_BMP_PATH = path.join(__dirname, '..', 'tests', 'fixtures', '8bit.bmp'); // For testing

interface ParsedArgs {
  rpcUrl?: string;
  walletName?: string;
  network: 'regtest' | 'testnet' | 'mainnet';
}

function parseArguments(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    network: 'regtest'
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--core-rpc-url' && i + 1 < args.length) {
      parsed.rpcUrl = args[++i];
    } else if (args[i] === '--wallet-name' && i + 1 < args.length) {
      parsed.walletName = args[++i];
    } else if (args[i] === '--network' && i + 1 < args.length) {
      const network = args[++i];
      if (network !== 'regtest' && network !== 'testnet' && network !== 'mainnet') {
        console.error('❌ Error: network must be regtest, testnet, or mainnet');
        process.exit(1);
      }
      parsed.network = network;
    }
  }

  return parsed;
}

async function runCLICommand(command: string): Promise<{ stdout: string; stderr: string }> {
  return await execAsync(command, { cwd: path.join(__dirname, '..') });
}

function extractTxid(output: string): string | null {
  const match = output.match(/Transaction ID: ([a-f0-9]{64})/);
  return match ? match[1] : null;
}

function extractDeedUTXO(output: string): string | null {
  const match = output.match(/Deed UTXO: ([a-f0-9]{64}:[0-9]+)/);
  return match ? match[1] : null;
}

async function makeClaim(x: number, y: number, uri: string, rpcUrl: string, walletName: string, network: string): Promise<{ txid: string | null, deedUTXO: string | null }> {
  const cmd = `npm run make-claim -- --x ${x} --y ${y} --uri "${uri}" --image "${REAL_BMP_PATH}" --core-rpc-url "${rpcUrl}" --wallet-name "${walletName}" --network ${network}`;
  try {
    const result = await runCLICommand(cmd);
    return {
      txid: extractTxid(result.stdout),
      deedUTXO: extractDeedUTXO(result.stdout)
    };
  } catch (error) {
    console.error(`Failed to create claim: ${error instanceof Error ? error.message : 'unknown'}`);
    return { txid: null, deedUTXO: null };
  }
}

async function makeUpdate(deedUTXO: string, x: number, y: number, newUri: string, rpcUrl: string, walletName: string, network: string): Promise<string | null> {
  const cmd = `npm run make-update -- --x ${x} --y ${y} --deed-utxo "${deedUTXO}" --uri "${newUri}" --image "${REAL_BMP_PATH}" --core-rpc-url "${rpcUrl}" --wallet-name "${walletName}" --network ${network}`;
  try {
    const result = await runCLICommand(cmd);
    return extractDeedUTXO(result.stdout);
  } catch (error) {
    console.error(`Failed to update: ${error instanceof Error ? error.message : 'unknown'}`);
    return null;
  }
}

async function makeTransfer(deedUTXO: string, newAddress: string, rpcUrl: string, walletName: string, network: string): Promise<string | null> {
  const cmd = `npm run make-transfer -- --deed-utxo "${deedUTXO}" --new-owner "${newAddress}" --core-rpc-url "${rpcUrl}" --wallet-name "${walletName}" --network ${network}`;
  try {
    const result = await runCLICommand(cmd);
    return extractDeedUTXO(result.stdout);
  } catch (error) {
    console.error(`Failed to transfer: ${error instanceof Error ? error.message : 'unknown'}`);
    return null;
  }
}

async function getNewAddress(rpcUrl: string, walletName: string): Promise<string | null> {
  const [protocol, rest] = rpcUrl.split('://');
  const [auth, hostPort] = rest.split('@');
  const [user, password] = auth.split(':');
  
  const cmd = `bitcoin-cli -rpcuser=${user} -rpcpassword=${password} -rpcconnect=${hostPort.split(':')[0]} -rpcport=${hostPort.split(':')[1] || '18443'} -rpcwallet=${walletName} getnewaddress`;
  try {
    const result = await execAsync(cmd);
    return result.stdout.trim();
  } catch (error) {
    console.error(`Failed to get new address: ${error instanceof Error ? error.message : 'unknown'}`);
    return null;
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  
  if (!args.rpcUrl || !args.walletName) {
    console.error('❌ Error: Missing required arguments');
    console.error('');
    console.error('Usage: npm run test-states -- --core-rpc-url <url> --wallet-name <name> [--network regtest]');
    process.exit(1);
  }
  
  console.log(`🧪 Testing All Plot States`);
  console.log(`Network: ${args.network}`);
  console.log(`Wallet: ${args.walletName}`);
  console.log('');

  const testResults: any = {
    placed: [],
    unplaced: [],
    updated: [],
    transferred: [],
    bricked: []
  };

  // Block 1: Create initial PLACED plots
  console.log(`\n📦 Block 1 - Initial PLACED plots:`);
  
  const plot1 = await makeClaim(10000, 10000, 'https://example.com/plot1', args.rpcUrl, args.walletName, args.network);
  if (plot1.txid) {
    console.log(`  ✅ Plot 1 at (10000, 10000) - ${plot1.txid.substring(0, 12)}... - Deed: ${plot1.deedUTXO}`);
    testResults.placed.push({ position: '10000,10000', txid: plot1.txid, deedUTXO: plot1.deedUTXO });
  }

  const plot2 = await makeClaim(20000, 20000, 'https://example.com/plot2', args.rpcUrl, args.walletName, args.network);
  if (plot2.txid) {
    console.log(`  ✅ Plot 2 at (20000, 20000) - ${plot2.txid.substring(0, 12)}... - Deed: ${plot2.deedUTXO}`);
    testResults.placed.push({ position: '20000,20000', txid: plot2.txid, deedUTXO: plot2.deedUTXO });
  }

  const plot3 = await makeClaim(30000, 30000, 'https://example.com/plot3', args.rpcUrl, args.walletName, args.network);
  if (plot3.txid) {
    console.log(`  ✅ Plot 3 at (30000, 30000) - ${plot3.txid.substring(0, 12)}... - Deed: ${plot3.deedUTXO}`);
    testResults.placed.push({ position: '30000,30000', txid: plot3.txid, deedUTXO: plot3.deedUTXO });
  }

  // Block 2: Create UNPLACED plots (overlapping with existing)
  console.log(`\n📦 Block 2 - UNPLACED plots (overlapping):`);
  
  const unplaced1 = await makeClaim(10050, 10050, 'https://example.com/unplaced1', args.rpcUrl, args.walletName, args.network);
  if (unplaced1.txid) {
    console.log(`  ⚠️  Unplaced 1 at (10050, 10050) - overlaps with Plot 1 - ${unplaced1.txid.substring(0, 12)}...`);
    testResults.unplaced.push({ position: '10050,10050', txid: unplaced1.txid });
  }

  const unplaced2 = await makeClaim(20100, 20100, 'https://example.com/unplaced2', args.rpcUrl, args.walletName, args.network);
  if (unplaced2.txid) {
    console.log(`  ⚠️  Unplaced 2 at (20100, 20100) - overlaps with Plot 2 - ${unplaced2.txid.substring(0, 12)}...`);
    testResults.unplaced.push({ position: '20100,20100', txid: unplaced2.txid });
  }

  // Block 3: UPDATE a plot
  console.log(`\n📦 Block 3 - UPDATE plot:`);
  
  if (plot1.deedUTXO) {
    const newDeedUTXO = await makeUpdate(plot1.deedUTXO, 10000, 10000, 'https://example.com/plot1-updated', args.rpcUrl, args.walletName, args.network);
    if (newDeedUTXO) {
      console.log(`  🔄 Updated Plot 1 - New URI: plot1-updated - New Deed: ${newDeedUTXO}`);
      testResults.updated.push({ originalTxid: plot1.txid, newDeedUTXO });
      plot1.deedUTXO = newDeedUTXO; // Update for potential future use
    }
  }

  // Block 4: TRANSFER a plot
  console.log(`\n📦 Block 4 - TRANSFER plot:`);
  
  const newAddress = await getNewAddress(args.rpcUrl, args.walletName);
  if (plot2.deedUTXO && newAddress) {
    const newDeedUTXO = await makeTransfer(plot2.deedUTXO, newAddress, args.rpcUrl, args.walletName, args.network);
    if (newDeedUTXO) {
      console.log(`  🔀 Transferred Plot 2 to ${newAddress.substring(0, 20)}... - New Deed: ${newDeedUTXO}`);
      testResults.transferred.push({ originalTxid: plot2.txid, newOwner: newAddress, newDeedUTXO });
      plot2.deedUTXO = newDeedUTXO; // Update for potential future use
    }
  }

  // Block 5: Create more plots, then BRICK one by spending deed incorrectly
  console.log(`\n📦 Block 5 - BRICK a plot (spend deed to wrong address):`);
  
  const plot4 = await makeClaim(40000, 40000, 'https://example.com/plot4', args.rpcUrl, args.walletName, args.network);
  if (plot4.txid && plot4.deedUTXO) {
    console.log(`  ✅ Plot 4 at (40000, 40000) - ${plot4.txid.substring(0, 12)}... - Deed: ${plot4.deedUTXO}`);
    testResults.placed.push({ position: '40000,40000', txid: plot4.txid, deedUTXO: plot4.deedUTXO });
    
    // Now brick it by spending the deed UTXO to a regular address (not as UPDATE/TRANSFER)
    const [protocol, rest] = args.rpcUrl.split('://');
    const [auth, hostPort] = rest.split('@');
    const [user, password] = auth.split(':');
    const [host, port] = hostPort.split(':');
    
    const regularAddress = await getNewAddress(args.rpcUrl, args.walletName);
    if (regularAddress) {
      try {
        // Spend the deed UTXO to a regular address (this bricks the plot)
        const [txid, vout] = plot4.deedUTXO.split(':');
        // First create a raw transaction, then sign and send it
        const createCmd = `bitcoin-cli -rpcuser=${user} -rpcpassword=${password} -rpcconnect=${host} -rpcport=${port || '18443'} -rpcwallet=${args.walletName} createrawtransaction '[{"txid":"${txid}","vout":${vout}}]' '[{"${regularAddress}":0.00000600}]'`;
        const { stdout: rawTxHex } = await execAsync(createCmd);
        
        const signCmd = `bitcoin-cli -rpcuser=${user} -rpcpassword=${password} -rpcconnect=${host} -rpcport=${port || '18443'} -rpcwallet=${args.walletName} signrawtransactionwithwallet ${rawTxHex.trim()}`;
        const { stdout: signResult } = await execAsync(signCmd);
        const signedTx = JSON.parse(signResult).hex;
        
        const sendCmd = `bitcoin-cli -rpcuser=${user} -rpcpassword=${password} -rpcconnect=${host} -rpcport=${port || '18443'} sendrawtransaction ${signedTx}`;
        await execAsync(sendCmd);
        
        console.log(`  🧱 Bricked Plot 4 by spending deed to regular address ${regularAddress.substring(0, 20)}...`);
        testResults.bricked.push({ txid: plot4.txid, reason: 'Deed spent to non-UBB address' });
      } catch (error) {
        console.log(`  ❌ Failed to brick plot: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }
  }

  // Block 6: A few more normal placed plots
  console.log(`\n📦 Block 6 - More PLACED plots:`);
  
  const plot5 = await makeClaim(50000, 50000, 'https://example.com/plot5', args.rpcUrl, args.walletName, args.network);
  if (plot5.txid) {
    console.log(`  ✅ Plot 5 at (50000, 50000) - ${plot5.txid.substring(0, 12)}...`);
    testResults.placed.push({ position: '50000,50000', txid: plot5.txid });
  }

  const plot6 = await makeClaim(60000, 10000, 'https://example.com/plot6', args.rpcUrl, args.walletName, args.network);
  if (plot6.txid) {
    console.log(`  ✅ Plot 6 at (60000, 10000) - ${plot6.txid.substring(0, 12)}...`);
    testResults.placed.push({ position: '60000,10000', txid: plot6.txid });
  }

  console.log(`\n✅ Test scenario complete!`);
  console.log(`\n📊 Summary:`);
  console.log(`   PLACED plots: ${testResults.placed.length}`);
  console.log(`   UNPLACED plots: ${testResults.unplaced.length}`);
  console.log(`   UPDATED plots: ${testResults.updated.length}`);
  console.log(`   TRANSFERRED plots: ${testResults.transferred.length}`);
  console.log(`   BRICKED plots: ${testResults.bricked.length}`);
  console.log(`\n📋 Next steps:`);
  console.log(`  1. Get the current tip and genesis hash from your Bitcoin Core node`);
  console.log(`  2. Run the indexer:`);
  console.log(`     npm run indexer -- <tip-hash> <genesis-hash> --network ${args.network} --block-source rpc --rpc-url ${args.rpcUrl}`);
  console.log(`  3. Verify the state has the expected plot statuses`);
  console.log('');

  // Save test results for verification
  console.log('\n📝 Test Results (for verification):');
  console.log(JSON.stringify(testResults, null, 2));
}

main().catch(console.error);
