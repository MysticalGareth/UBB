#!/usr/bin/env node

/**
 * esbuild configuration for bundling UBB static web applications
 * Outputs directly to docs/js/ for GitHub Pages deployment
 */

const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    // Build Claim Builder
    await esbuild.build({
      entryPoints: ['src/browser/claim-builder.ts'],
      bundle: true,
      outfile: 'docs/js/claim-builder.bundle.js',
      format: 'iife',
      globalName: 'UBBClaimBuilder',
      platform: 'browser',
      target: ['es2020'],
      minify: false, // Set to true for production
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'window',
      },
      inject: [path.join(__dirname, 'src/browser/buffer-shim.js')],
      banner: {
        js: '/* UBB Claim Builder - Browser Bundle */',
      },
    });
    
    console.log('✓ Claim Builder bundle built successfully');
    console.log('  Output: docs/js/claim-builder.bundle.js');
    
    // Build Verifier
    await esbuild.build({
      entryPoints: ['src/browser/verifier.ts'],
      bundle: true,
      outfile: 'docs/js/verifier.bundle.js',
      format: 'iife',
      globalName: 'UBBVerifier',
      platform: 'browser',
      target: ['es2020'],
      minify: false, // Set to true for production
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"production"',
        'global': 'window',
      },
      inject: [path.join(__dirname, 'src/browser/buffer-shim.js')],
      banner: {
        js: '/* UBB Claim Verifier - Browser Bundle */',
      },
    });
    
    console.log('✓ Verifier bundle built successfully');
    console.log('  Output: docs/js/verifier.bundle.js');
    
    // Build Transaction Validator
    await esbuild.build({
      entryPoints: ['src/browser/transaction-validator.ts'],
      bundle: true,
      outfile: 'docs/js/transaction-validator.bundle.js',
      format: 'iife',
      // Don't use globalName - let the code set window.UBBTransactionValidator directly
      platform: 'browser',
      target: ['es2020'],
      minify: false, // Set to true for production
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"production"',
        'process.env.NODE_DEBUG': 'false',
        'global': 'window',
      },
      inject: [
        path.join(__dirname, 'src/browser/buffer-shim.js'),
        require.resolve('process/browser')
      ],
      alias: {
        'crypto': 'crypto-browserify',
        'stream': 'stream-browserify',
        'assert': 'assert',
        'url': 'url',
        'events': 'events',
      },
      banner: {
        js: `/* UBB Transaction Validator - Browser Bundle */
// Polyfill process for browser
if (typeof process === 'undefined') {
  window.process = {
    env: { NODE_ENV: 'production', NODE_DEBUG: false },
    version: '',
    versions: {},
    browser: true,
    nextTick: function(fn) { setTimeout(fn, 0); }
  };
}`,
      },
    });
    
    console.log('✓ Transaction Validator bundle built successfully');
    console.log('  Output: docs/js/transaction-validator.bundle.js');
  } catch (error) {
    console.error('✗ Build failed:', error);
    process.exit(1);
  }
}

build();
