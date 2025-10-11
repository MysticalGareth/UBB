/**
 * Populate Billboard Script
 * 
 * Creates many CLAIM transactions spread across the billboard
 * to test canvas performance with realistic data.
 * 
 * Now uses the make-claim CLI command to validate the full user workflow.
 * 
 * Usage:
 *   npm run populate -- [plot-count] [plots-per-block] --core-rpc-url <url> --wallet-name <name> [--network regtest]
 * 
 * Arguments:
 *   plot-count         Number of plots to create (default: 25)
 *   plots-per-block    Plots per block (default: 5)
 *   --core-rpc-url     Bitcoin Core RPC URL (required)
 *   --wallet-name      Wallet name (required)
 *   --network          Network: regtest, testnet, mainnet (default: regtest)
 * 
 * Examples:
 *   npm run populate -- 25 5 --core-rpc-url http://user:pass@127.0.0.1:18443 --wallet-name test_wallet
 *   npm run populate -- 50 10 --core-rpc-url http://user:pass@127.0.0.1:18443 --wallet-name test_wallet --network regtest
 */

import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const REAL_BMP_PATH = path.join(__dirname, '..', 'tests', 'fixtures', 'bitcoin_uncompressed_24.bmp');
const REAL_BMP_WIDTH = 128;
const REAL_BMP_HEIGHT = 127;

interface PlotPosition {
  x: number;
  y: number;
  description: string;
}

interface ParsedArgs {
  plotCount: number;
  plotsPerBlock: number;
  rpcUrl?: string;
  walletName?: string;
  network: 'regtest' | 'testnet' | 'mainnet';
}

/**
 * Parse command line arguments
 */
function parseArguments(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    plotCount: 25,
    plotsPerBlock: 5,
    network: 'regtest'
  };

  // First two positional args are numbers
  if (args.length > 0 && !args[0].startsWith('--')) {
    parsed.plotCount = parseInt(args[0]);
  }
  if (args.length > 1 && !args[1].startsWith('--')) {
    parsed.plotsPerBlock = parseInt(args[1]);
  }

  // Parse named arguments
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

/**
 * Extract transaction ID from CLI output
 */
function extractTxid(output: string): string | null {
  const match = output.match(/Transaction ID: ([a-f0-9]{64})/);
  return match ? match[1] : null;
}

/**
 * Extract block hash from CLI output
 */
function extractBlockHash(output: string): string | null {
  const match = output.match(/Block mined: ([a-f0-9]{64})/);
  return match ? match[1] : null;
}

/**
 * Run a CLI command and return output
 */
async function runCLICommand(command: string): Promise<{ stdout: string; stderr: string }> {
  return await execAsync(command, { cwd: path.join(__dirname, '..') });
}

/**
 * Generate plot positions across the billboard
 */
function generatePlotPositions(count: number): PlotPosition[] {
  const positions: PlotPosition[] = [
    // Corner plots
    { x: 0, y: 0, description: 'Top-left corner' },
    { x: 65408, y: 0, description: 'Top-right corner' },
    { x: 0, y: 65408, description: 'Bottom-left corner' },
    { x: 65408, y: 65408, description: 'Bottom-right corner' },
    
    // Center
    { x: 32704, y: 32704, description: 'Center' },
    
    // Mid-edges
    { x: 32704, y: 0, description: 'Top edge center' },
    { x: 32704, y: 65408, description: 'Bottom edge center' },
    { x: 0, y: 32704, description: 'Left edge center' },
    { x: 65408, y: 32704, description: 'Right edge center' },
  ];

  // Add random positions in different quadrants
  const quadrants = [
    { minX: 1000, maxX: 16000, minY: 1000, maxY: 16000, name: 'Quadrant 1' },
    { minX: 32000, maxX: 48000, minY: 1000, maxY: 16000, name: 'Quadrant 2' },
    { minX: 1000, maxX: 16000, minY: 32000, maxY: 48000, name: 'Quadrant 3' },
    { minX: 32000, maxX: 48000, minY: 32000, maxY: 48000, name: 'Quadrant 4' },
  ];

  const plotsPerQuadrant = Math.ceil((count - positions.length) / quadrants.length);
  
  quadrants.forEach((quadrant) => {
    for (let i = 0; i < plotsPerQuadrant && positions.length < count; i++) {
      const x = Math.floor(Math.random() * (quadrant.maxX - quadrant.minX) + quadrant.minX);
      const y = Math.floor(Math.random() * (quadrant.maxY - quadrant.minY) + quadrant.minY);
      
      // Make sure we don't overlap with existing positions
      const tooClose = positions.some(pos => 
        Math.abs(pos.x - x) < REAL_BMP_WIDTH && 
        Math.abs(pos.y - y) < REAL_BMP_HEIGHT
      );
      
      if (!tooClose) {
        positions.push({
          x,
          y,
          description: `${quadrant.name} plot ${i + 1}`
        });
      }
    }
  });

  return positions.slice(0, count);
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  
  // Validate required arguments
  if (!args.rpcUrl || !args.walletName) {
    console.error('❌ Error: Missing required arguments');
    console.error('');
    console.error('Usage: npm run populate -- [plot-count] [plots-per-block] --core-rpc-url <url> --wallet-name <name> [--network regtest]');
    console.error('');
    console.error('Required:');
    console.error('  --core-rpc-url <url>    Bitcoin Core RPC URL');
    console.error('  --wallet-name <name>    Wallet name');
    console.error('');
    console.error('Optional:');
    console.error('  plot-count              Number of plots (default: 25)');
    console.error('  plots-per-block         Plots per block (default: 5)');
    console.error('  --network <network>     Network: regtest, testnet, mainnet (default: regtest)');
    console.error('');
    console.error('Example:');
    console.error('  npm run populate -- 25 5 --core-rpc-url http://user:pass@127.0.0.1:18443 --wallet-name test_wallet');
    process.exit(1);
  }
  
  console.log(`🎨 Billboard Population Script`);
  console.log(`Creating ${args.plotCount} plots (${args.plotsPerBlock} per block)`);
  console.log(`Network: ${args.network}`);
  console.log(`Wallet: ${args.walletName}`);
  console.log('');

  // Generate positions
  const positions = generatePlotPositions(args.plotCount);
  console.log(`📍 Generated ${positions.length} positions across the billboard\n`);

  // Create transactions in batches
  let totalCreated = 0;
  let blockCount = 0;

  for (let i = 0; i < positions.length; i += args.plotsPerBlock) {
    const batch = positions.slice(i, i + args.plotsPerBlock);
    blockCount++;
    
    console.log(`\n📦 Block ${blockCount} - Creating ${batch.length} claims:`);
    
    for (const pos of batch) {
      try {
        // Create a unique URI for each plot
        const uri = `https://example.com/plot-${pos.x}-${pos.y}`;
        
        // Build make-claim command
        const cmd = `npm run make-claim -- --x ${pos.x} --y ${pos.y} --uri "${uri}" --image "${REAL_BMP_PATH}" --core-rpc-url "${args.rpcUrl}" --wallet-name "${args.walletName}" --network ${args.network}`;
        
        const result = await runCLICommand(cmd);
        const txid = extractTxid(result.stdout);
        
        if (txid) {
          totalCreated++;
          console.log(`  ✅ (${pos.x}, ${pos.y}) - ${pos.description} - ${txid.substring(0, 12)}... - URI: ${uri}`);
        } else {
          console.log(`  ⚠️  (${pos.x}, ${pos.y}) - ${pos.description} - Created but couldn't extract txid`);
          totalCreated++;
        }
      } catch (error) {
        console.log(`  ❌ (${pos.x}, ${pos.y}) - ${pos.description} - ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }

    // Extract block hash from last transaction's output (which includes mining)
    console.log(`  ⛏️  Block mined (${batch.length} transactions)`);
  }

  console.log(`\n✅ Created ${totalCreated} plots across ${blockCount} blocks\n`);
  console.log(`📋 Next steps:`);
  console.log(`  1. Get the tip hash and genesis hash from your Bitcoin Core node`);
  console.log(`  2. Run the indexer:`);
  console.log(`     npm run indexer -- <tip-hash> <genesis-hash> --network ${args.network} --rpc-url <rpc-url>`);
  console.log(`  3. Start the web server:`);
  console.log(`     npm run web -- --env=${args.network} --genesis-hash=<genesis-hash> --port=3000`);
  console.log('');
}

main().catch(console.error);