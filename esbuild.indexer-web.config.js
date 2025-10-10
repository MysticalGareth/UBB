#!/usr/bin/env node

/**
 * esbuild configuration for bundling UBB Indexer Web frontend
 * Compiles TypeScript frontend modules to JavaScript for browser use
 */

const esbuild = require('esbuild');
const path = require('path');

async function build() {
  try {
    // Build Frontend App
    await esbuild.build({
      entryPoints: ['src/indexer-web/frontend/app.ts'],
      bundle: true,
      outfile: 'dist/indexer-web/frontend/app.js',
      format: 'esm',
      platform: 'browser',
      target: ['es2020'],
      minify: false, // Set to true for production
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"production"',
      },
      banner: {
        js: '/* UBB Indexer Web - Frontend App */',
      },
    });
    
    console.log('✓ Indexer Web frontend built successfully');
    console.log('  Output: dist/indexer-web/frontend/app.js');
    
    // Also copy CSS to dist
    const fs = require('fs');
    fs.mkdirSync('dist/indexer-web/templates', { recursive: true });
    fs.copyFileSync(
      'src/indexer-web/templates/styles.css',
      'dist/indexer-web/templates/styles.css'
    );
    fs.copyFileSync(
      'src/indexer-web/templates/index.html',
      'dist/indexer-web/templates/index.html'
    );
    
    console.log('✓ Templates and styles copied');
    console.log('  Output: dist/indexer-web/templates/');
  } catch (error) {
    console.error('✗ Build failed:', error);
    process.exit(1);
  }
}

build();
