#!/usr/bin/env ts-node

/**
 * Build script for static GitHub Pages version of indexer-web
 * Reads the state_at_tip symlink and generates static files
 */

import * as fs from 'fs';
import * as path from 'path';

// Hardcoded genesis hash for mainnet
const MAINNET_GENESIS = '000000000000000000010fa5bf8de1bff433e934e03ed671186592c8c3560f6e';

interface BuildOptions {
  network: 'mainnet' | 'testnet' | 'regtest';
  genesisHash: string;
  dataDir: string;
}

function parseArgs(): BuildOptions {
  const args = process.argv.slice(2);
  const options: BuildOptions = {
    network: 'mainnet',
    genesisHash: '',
    dataDir: 'docs/data'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--network':
        const network = args[++i];
        if (network === 'mainnet' || network === 'testnet' || network === 'regtest') {
          options.network = network;
        } else {
          console.error(`Invalid network: ${network}`);
          process.exit(1);
        }
        break;
      case '--genesis-hash':
        options.genesisHash = args[++i];
        break;
      case '--data-dir':
        options.dataDir = args[++i];
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${arg}`);
        process.exit(1);
    }
  }

  // Use hardcoded genesis for mainnet if not provided
  if (!options.genesisHash) {
    if (options.network === 'mainnet') {
      options.genesisHash = MAINNET_GENESIS;
      console.log(`Using hardcoded mainnet genesis: ${options.genesisHash}`);
    } else {
      console.error('Error: --genesis-hash is required for testnet/regtest');
      process.exit(1);
    }
  }

  if (!/^[a-fA-F0-9]{64}$/.test(options.genesisHash)) {
    console.error('Error: genesis-hash must be a 64-character hexadecimal string');
    process.exit(1);
  }

  return options;
}

function printHelp(): void {
  console.log(`
Build Static Indexer for GitHub Pages

USAGE:
  ts-node scripts/build-static-indexer.ts [options]
  npm run build:indexer-web-static [-- options]

OPTIONS:
  --network <network>       Network: mainnet, testnet, or regtest (default: mainnet)
  --genesis-hash <hash>     UBB genesis block hash (optional for mainnet, uses hardcoded value)
  --data-dir <dir>          Data directory path (default: docs/data)
  --help, -h                Show this help message

EXAMPLES:
  # Simplest usage - mainnet with hardcoded genesis
  npm run build:indexer-web-static

  # With custom data directory
  npm run build:indexer-web-static -- --data-dir /path/to/data

  # Testnet (genesis hash required)
  npm run build:indexer-web-static -- --network testnet --genesis-hash <hash>
`);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main(): Promise<void> {
  const options = parseArgs();
  
  console.log('Building static indexer for GitHub Pages...');
  console.log(`Network: ${options.network}`);
  console.log(`Genesis Hash: ${options.genesisHash}`);
  console.log(`Data Dir: ${options.dataDir}`);
  console.log('');

  // Construct paths
  const basePath = path.join(options.dataDir, options.network, 'v1', options.genesisHash);
  const symlinkPath = path.join(basePath, 'state_at_tip');
  const outputDir = 'docs';
  
  // Check if symlink exists
  if (!fs.existsSync(symlinkPath)) {
    console.error(`Error: Tip symlink not found at: ${symlinkPath}`);
    console.error('Make sure the indexer has run and created the state_at_tip symlink');
    process.exit(1);
  }

  // Read the symlink to get the tip hash
  let tipHash: string;
  try {
    const symlinkTarget = fs.readlinkSync(symlinkPath);
    console.log(`Symlink target: ${symlinkTarget}`);
    
    // Extract hash from target (e.g., "states/abc123..." -> "abc123...")
    tipHash = path.basename(symlinkTarget);
    console.log(`Tip hash: ${tipHash}`);
    
    if (!/^[a-fA-F0-9]{64}$/.test(tipHash)) {
      console.error(`Error: Invalid tip hash extracted from symlink: ${tipHash}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error reading symlink: ${error}`);
    process.exit(1);
  }

  // Ensure output directories exist (js and css already exist in docs)
  ensureDir(path.join(outputDir, 'js'));
  ensureDir(path.join(outputDir, 'css'));
  
  // Generate config.js with relative paths (works for both root and project page deployments)
  const dataPath = `data/${options.network}/v1/${options.genesisHash}`;
  const configJs = `// UBB Indexer Configuration - Generated at ${new Date().toISOString()}
window.UBB_CONFIG = {
  environment: "${options.network}",
  genesisHash: "${options.genesisHash}",
  tipHash: "${tipHash}",
  dataPath: "${dataPath}"
};
`;

  const configPath = path.join(outputDir, 'config.js');
  fs.writeFileSync(configPath, configJs);
  console.log(`✓ Generated config.js`);

  // Copy index.html
  const indexHtmlSrc = 'dist/indexer-web/templates/index.html';
  const indexHtmlDest = path.join(outputDir, 'index.html');
  
  if (!fs.existsSync(indexHtmlSrc)) {
    console.error(`Error: Source index.html not found at: ${indexHtmlSrc}`);
    console.error('Run "npm run build:indexer-web" first to build the frontend');
    process.exit(1);
  }
  
  fs.copyFileSync(indexHtmlSrc, indexHtmlDest);
  console.log(`✓ Copied index.html`);

  // Copy styles.css
  const stylesSrc = 'dist/indexer-web/templates/styles.css';
  const stylesDest = path.join(outputDir, 'css', 'styles.css');
  
  if (!fs.existsSync(stylesSrc)) {
    console.error(`Error: Source styles.css not found at: ${stylesSrc}`);
    process.exit(1);
  }
  
  fs.copyFileSync(stylesSrc, stylesDest);
  console.log(`✓ Copied styles.css`);

  // Copy app.js and sourcemap
  const appJsSrc = 'dist/indexer-web/frontend/app.js';
  const appJsDest = path.join(outputDir, 'js', 'app.js');
  
  if (!fs.existsSync(appJsSrc)) {
    console.error(`Error: Source app.js not found at: ${appJsSrc}`);
    process.exit(1);
  }
  
  fs.copyFileSync(appJsSrc, appJsDest);
  console.log(`✓ Copied app.js`);
  
  // Copy sourcemap if it exists
  const appJsMapSrc = 'dist/indexer-web/frontend/app.js.map';
  const appJsMapDest = path.join(outputDir, 'js', 'app.js.map');
  
  if (fs.existsSync(appJsMapSrc)) {
    fs.copyFileSync(appJsMapSrc, appJsMapDest);
    console.log(`✓ Copied app.js.map`);
  }

  // .nojekyll already exists in docs
  const nojekyllPath = 'docs/.nojekyll';
  if (!fs.existsSync(nojekyllPath)) {
    fs.writeFileSync(nojekyllPath, '');
    console.log(`✓ Created .nojekyll`);
  } else {
    console.log(`✓ .nojekyll already exists`);
  }

  console.log('');
  console.log('✅ Static indexer built successfully!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Commit the changes in docs/');
  console.log('  2. Push to GitHub');
  console.log('  3. Enable GitHub Pages from the /docs folder in repository settings');
  console.log('');
  console.log(`Your site will be available at: https://<username>.github.io/<repo>/`);
}

main().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});

