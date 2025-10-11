#!/usr/bin/env ts-node

/**
 * Convenience script to run indexer and build static GitHub Pages site
 * Hardcoded for mainnet with specific genesis hash
 */

import { spawn } from 'child_process';

// Hardcoded configuration for mainnet
const NETWORK = 'mainnet';
const DATA_DIR = 'docs/data';

function printHelp(): void {
  console.log(`
Run Indexer for GitHub Pages

This script runs the UBB indexer and builds the static site for GitHub Pages.
It's pre-configured for mainnet and uses the hardcoded genesis hash.

USAGE:
  npm run indexer:gh-pages -- --rpc-url <url> [additional-indexer-args]

EXAMPLES:
  # Run with local Bitcoin Core node
  npm run indexer:gh-pages -- --rpc-url http://user:pass@localhost:8332

  # Show help
  npm run indexer:gh-pages -- --help

HARDCODED VALUES:
  Network:      ${NETWORK}
  Data Dir:     ${DATA_DIR}

NOTE: The mainnet UBB genesis hash is hardcoded in the indexer CLI, so you
      only need to provide your Bitcoin Core RPC URL.
`);
}

async function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${command} ${args.join(' ')}\n`);
    
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}`));
      } else {
        resolve();
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function main(): Promise<void> {
  const userArgs = process.argv.slice(2);

  // Check for help flag
  if (userArgs.includes('--help') || userArgs.includes('-h')) {
    printHelp();
    return;
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  UBB Indexer for GitHub Pages');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Network:      ${NETWORK}`);
  console.log(`Data Dir:     ${DATA_DIR}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Step 1: Run the indexer
  console.log('📊 Step 1/2: Running indexer...\n');
  
  // No need to pass genesis hash - uses hardcoded mainnet genesis
  const indexerArgs = [
    'run',
    'indexer',
    '--',
    '--data-dir', DATA_DIR,
    '--network', NETWORK,
    ...userArgs
  ];

  try {
    await runCommand('npm', indexerArgs);
    console.log('\n✓ Indexer completed successfully\n');
  } catch (error) {
    console.error('\n✗ Indexer failed:', error);
    process.exit(1);
  }

  // Step 2: Build static site
  console.log('🔨 Step 2/2: Building static site...\n');
  
  const buildArgs = [
    'run',
    'build:indexer-web-static',
    '--',
    '--network', NETWORK,
    '--data-dir', DATA_DIR
  ];

  try {
    await runCommand('npm', buildArgs);
    console.log('\n✓ Static site built successfully\n');
  } catch (error) {
    console.error('\n✗ Build failed:', error);
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ All done!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\nNext steps:');
  console.log('  1. Review changes in docs/');
  console.log('  2. git add docs/');
  console.log('  3. git commit -m "Update indexer web data"');
  console.log('  4. git push');
  console.log('\nYour GitHub Pages site will update automatically!');
  console.log('');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

