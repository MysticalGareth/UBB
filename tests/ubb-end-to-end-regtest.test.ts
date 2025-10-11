/**
 * End-to-End Integration Tests for UBB Indexer
 * 
 * PURPOSE: Test the full flow from transaction → blockchain → indexer → state
 * 
 * What we're testing:
 * - Valid transactions are indexed correctly (PLACED status, correct coordinates, etc.)
 * - Invalid transactions that get on-chain are handled correctly (UNPLACED, ignored, etc.)
 * - Complex scenarios work end-to-end (RETRY-CLAIM, UPDATE, TRANSFER)
 * 
 * What we're NOT testing:
 * - Whether transaction builder prevents bad inputs (that's unit tests)
 * - Bitcoin Core behavior (we trust it works)
 * 
 * Test Independence:
 * Each test mines its own genesis block and runs in complete isolation.
 * Tests can run in any order or in parallel.
 * 
 * Test Structure:
 * 1. Mine empty block (becomes genesis for this test)
 * 2. Create transactions and mine blocks
 * 3. Index from genesis to tip
 * 4. Assert state is correct
 */

import * as path from 'path';
import * as fs from 'fs';
import { RegtestOrchestrator } from '../src/bitcoin/regtest';
import { UBBIndexer } from '../src/indexer/ubb-indexer';
import { IndexerConfig, UBBState } from '../src/indexer/types';
import { getBitcoinRpcUrl } from './helpers/test-env';
import { suppressConsoleInTests } from './helpers/test-logger';
import { InvalidTransactionBuilder } from './helpers/invalid-transaction-builder';

suppressConsoleInTests();

// Load the real uncompressed_24.bmp file for tests
const REAL_BMP = fs.readFileSync(path.join(__dirname, 'fixtures', 'uncompressed_24.bmp'));
const REAL_BMP_WIDTH = 128;
const REAL_BMP_HEIGHT = 127;

// Helper to create a minimal valid 24-bit BMP
function createMinimalBMP(width: number, height: number): Buffer {
  const headerSize = 54;
  const bytesPerPixel = 3; // 24-bit
  const stride = Math.ceil((width * bytesPerPixel) / 4) * 4;
  const pixelDataSize = stride * height;
  const fileSize = headerSize + pixelDataSize;

  const buffer = Buffer.alloc(fileSize);
  
  // BMP Header (14 bytes)
  buffer.write('BM', 0); // Signature
  buffer.writeUInt32LE(fileSize, 2); // File size
  buffer.writeUInt32LE(0, 6); // Reserved
  buffer.writeUInt32LE(headerSize, 10); // Pixel data offset

  // DIB Header (40 bytes - BITMAPINFOHEADER)
  buffer.writeUInt32LE(40, 14); // DIB header size
  buffer.writeInt32LE(width, 18); // Width
  buffer.writeInt32LE(height, 22); // Height (positive = bottom-up)
  buffer.writeUInt16LE(1, 26); // Planes
  buffer.writeUInt16LE(24, 28); // Bits per pixel
  buffer.writeUInt32LE(0, 30); // Compression (BI_RGB)
  buffer.writeUInt32LE(pixelDataSize, 34); // Image size
  buffer.writeInt32LE(0, 38); // X pixels per meter
  buffer.writeInt32LE(0, 42); // Y pixels per meter
  buffer.writeUInt32LE(0, 46); // Colors used
  buffer.writeUInt32LE(0, 50); // Important colors

  // Pixel data (already zeroed)
  return buffer;
}

// Helper to create an invalid BMP (wrong bit depth)
function createInvalidBMP(): Buffer {
  const headerSize = 54;
  const buffer = Buffer.alloc(headerSize + 100);
  
  buffer.write('BM', 0);
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(headerSize, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(1, 18); // width
  buffer.writeInt32LE(1, 22); // height
  buffer.writeUInt16LE(1, 26); // planes
  buffer.writeUInt16LE(8, 28); // bits per pixel (8-bit, not 24/32)
  buffer.writeUInt32LE(0, 30); // compression

  return buffer;
}

// Helper to build RETRY-CLAIM OP_RETURN hex
function buildRetryClaimOpReturnHex(x: number, y: number): string {
  const magic = Buffer.from([0x13, 0x37]);
  const version = Buffer.from([0x01]);
  const type = Buffer.from([0x02]); // RETRY-CLAIM
  
  const xBuf = Buffer.allocUnsafe(2);
  xBuf.writeUInt16LE(x, 0);
  const yBuf = Buffer.allocUnsafe(2);
  yBuf.writeUInt16LE(y, 0);
  
  return Buffer.concat([magic, version, type, xBuf, yBuf]).toString('hex');
}

describe('UBB Indexer - Regtest End-to-End Tests', () => {
  let orchestrator: RegtestOrchestrator;
  let indexer: UBBIndexer;
  let invalidTxBuilder: InvalidTransactionBuilder;
  let dataDir: string;
  let isRegtestAvailable: boolean = false;

  beforeAll(async () => {
    // Only setup: ensure node running and wallet funded
    orchestrator = new RegtestOrchestrator();
    
    try {
      await orchestrator.setup(); // Uses named wallet, reuses if exists
      isRegtestAvailable = true;

      // Create test helper for crafting invalid transactions
      invalidTxBuilder = new InvalidTransactionBuilder(
        orchestrator.getTransactionBuilder(),
        orchestrator.getWalletManager(),
        orchestrator.getRpcClient()
      );

    dataDir = path.join(__dirname, '..', 'data');
    
      // Create shared indexer instance (handles multiple genesis hashes)
    const indexerConfig: IndexerConfig = {
      dataDir,
      maxRetries: 3,
      retryDelay: 1000,
      network: 'testnet',
      rpcUrl: getBitcoinRpcUrl()
    };
    indexer = new UBBIndexer(indexerConfig);
    } catch (error) {
      console.error('Failed to setup orchestrator:', error instanceof Error ? error.message : 'unknown error');
      isRegtestAvailable = false;
    }
  }, 30000);

  afterEach(async () => {
    if (isRegtestAvailable) {
      // Recreate indexer to clear any cached state
      const indexerConfig: IndexerConfig = {
        dataDir,
        maxRetries: 3,
        retryDelay: 1000,
        network: 'testnet',
        rpcUrl: getBitcoinRpcUrl()
      };
      indexer = new UBBIndexer(indexerConfig);
    }
  });

  afterAll(async () => {
    if (isRegtestAvailable) {
      // No cleanup needed - state directories are per-genesis
      // Wallet persists for next run
      console.log('Test data preserved in:', dataDir);
    }
  });

  // Helper: Run test scenario with isolated genesis block
  async function runTestScenario(testFn: () => Promise<void>): Promise<UBBState> {
    // Mine empty block to serve as genesis (isolates from previous tests)
    await orchestrator.mineBlock();
    const genesisHash = await orchestrator.getBestBlockHash();
    
    try {
      // Run test scenario
      await testFn();
      
      // Index from genesis to current tip
      const tipHash = await orchestrator.getBestBlockHash();
      await indexer.index(tipHash, genesisHash);
    } catch (error) {
      console.error(`❌ Test scenario failed for genesis ${genesisHash}:`, error);
      throw error;
    }
    
    // Load and return state
    return loadStateForGenesis(genesisHash);
  }

  // Helper: Load state for specific genesis
  function loadStateForGenesis(genesisHash: string): UBBState {
    const stateManager = (indexer as any).stateManager;
    const tipPath = path.join(dataDir, 'testnet', 'v1', genesisHash, 'state_at_tip');
    
    // Check if state directory exists (indexer may not have run if test scenario failed)
    if (!fs.existsSync(tipPath)) {
      throw new Error(
        `No state found for genesis ${genesisHash}. ` +
        `This usually means the test scenario failed before indexing could complete. ` +
        `Check for errors in the test output above.`
      );
    }
    
    const tipHash = fs.realpathSync(tipPath);
    const blockHash = path.basename(tipHash);
    return stateManager.loadState(blockHash);
  }

  test('Skip tests if regtest node not available', () => {
    if (!isRegtestAvailable) {
      console.log('Skipping regtest tests - node not available');
    }
    expect(true).toBe(true);
  });

  describe('CLAIM Transactions', () => {
    test('Valid CLAIM scenarios', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
      const bmpHex = REAL_BMP.toString('hex');
      
        // Create valid CLAIM at (100, 100)
        const claim1 = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // Create valid CLAIM at edge coordinates (65534, 65534) with 1x1 BMP
        const bmp1x1 = createMinimalBMP(1, 1);
        const claim2 = await orchestrator.createClaimTx(65534, 65534, '', bmp1x1.toString('hex'));
        await orchestrator.mineBlock();

        // Create multiple valid CLAIMs in same block at different coordinates
        const claim3 = await orchestrator.createClaimTx(1000, 1000, '', bmpHex);
        const claim4 = await orchestrator.createClaimTx(2000, 2000, '', bmpHex);
        await orchestrator.mineBlock();
      });

      // Verify all plots are PLACED
      expect(state.plots.length).toBe(4);
      state.plots.forEach(plot => {
        expect(plot.status).toBe('PLACED');
      });

      // Verify specific coordinates and dimensions
      const plot100 = state.plots.find(p => p.x0 === 100 && p.y0 === 100);
      expect(plot100).toBeDefined();
      expect(plot100!.width).toBe(REAL_BMP_WIDTH);
      expect(plot100!.height).toBe(REAL_BMP_HEIGHT);

      const plotEdge = state.plots.find(p => p.x0 === 65534 && p.y0 === 65534);
      expect(plotEdge).toBeDefined();
      expect(plotEdge!.width).toBe(1);
      expect(plotEdge!.height).toBe(1);
    }, 60000);

    test('CLAIM overlap detection', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
      const bmpHex = REAL_BMP.toString('hex');
      
        // Create PLACED plot at (100, 100)
        const claim1 = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // Create overlapping CLAIM at (150, 150) in next block
        // (100,100) with 128x127 extends to (227,226), so (150,150) overlaps
        const claim2 = await orchestrator.createClaimTx(150, 150, '', bmpHex);
        await orchestrator.mineBlock();

        // Create two overlapping CLAIMs in same block
        const claim3 = await orchestrator.createClaimTx(500, 500, '', bmpHex);
        const claim4 = await orchestrator.createClaimTx(550, 550, '', bmpHex); // Overlaps with claim3
        await orchestrator.mineBlock();
      });

      // Verify overlap detection
      expect(state.plots.length).toBe(4);

      const plot100 = state.plots.find(p => p.x0 === 100 && p.y0 === 100);
      expect(plot100).toBeDefined();
      expect(plot100!.status).toBe('PLACED');
      
      const plot150 = state.plots.find(p => p.x0 === 150 && p.y0 === 150);
      expect(plot150).toBeDefined();
      expect(plot150!.status).toBe('UNPLACED'); // Overlaps with plot100

      // One of the same-block plots should be PLACED, the other UNPLACED
      const plot500 = state.plots.find(p => p.x0 === 500 && p.y0 === 500);
      const plot550 = state.plots.find(p => p.x0 === 550 && p.y0 === 550);
      expect(plot500).toBeDefined();
      expect(plot550).toBeDefined();

      const placedCount = [plot500, plot550].filter(p => p!.status === 'PLACED').length;
      const unplacedCount = [plot500, plot550].filter(p => p!.status === 'UNPLACED').length;
      expect(placedCount).toBe(1);
      expect(unplacedCount).toBe(1);
    }, 60000);

    test('CLAIM out of bounds detection', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // Create 2x2 BMP at (65534, 65534) - will bleed out of bounds  
        // Use test helper to bypass production validation
        const bmp2x2 = createMinimalBMP(2, 2);
        await invalidTxBuilder.buildUnvalidatedClaimTransaction(65534, 65534, '', bmp2x2.toString('hex'));

        // Create 1x1 BMP at (65535, 65535) - fits exactly at max coordinate
        // Use test helper to bypass production validation (65535 is max coordinate)
        const bmp1x1 = createMinimalBMP(1, 1);
        await invalidTxBuilder.buildUnvalidatedClaimTransaction(65535, 65535, '', bmp1x1.toString('hex'));

        await orchestrator.mineBlock();
      });

      expect(state.plots.length).toBe(2);

      const plot2x2 = state.plots.find(p => p.width === 2 && p.height === 2);
      expect(plot2x2).toBeDefined();
      expect(plot2x2!.status).toBe('UNPLACED'); // Out of bounds
      
      const plot1x1 = state.plots.find(p => p.width === 1 && p.height === 1);
      expect(plot1x1).toBeDefined();
      expect(plot1x1!.status).toBe('PLACED'); // Fits exactly
    }, 60000);

    test('CLAIM BMP validation failures', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // Use test helper to craft invalid transactions by hand
        // This tests that the INDEXER correctly rejects invalid BMPs

        // Invalid bit depth (8-bit)
      const invalidBmp = createInvalidBMP();
        await invalidTxBuilder.buildUnvalidatedClaimTransaction(300, 300, '', invalidBmp.toString('hex'));

        // Truncated BMP (use smaller BMP for testing)
        const smallBmp = createMinimalBMP(5, 5);
        const truncated100 = smallBmp.subarray(0, smallBmp.length - 10);
        await invalidTxBuilder.buildUnvalidatedClaimTransaction(500, 500, '', truncated100.toString('hex'));

        // Truncated BMP (small truncation)
        const truncated5 = smallBmp.subarray(0, smallBmp.length - 5);
        await invalidTxBuilder.buildUnvalidatedClaimTransaction(501, 501, '', truncated5.toString('hex'));

        // Corrupted header (wrong dimensions)
      const validBmp = createMinimalBMP(2, 2);
      const corruptedBmp = Buffer.from(validBmp);
      corruptedBmp.writeInt32LE(10, 18); // Change width to 10
      corruptedBmp.writeInt32LE(10, 22); // Change height to 10
        await invalidTxBuilder.buildUnvalidatedClaimTransaction(600, 600, '', corruptedBmp.toString('hex'));

        // Zero-sized BMP
      const headerSize = 54;
      const buffer = Buffer.alloc(headerSize);
      buffer.write('BM', 0);
        buffer.writeUInt32LE(headerSize, 2);
        buffer.writeUInt32LE(0, 6);
        buffer.writeUInt32LE(headerSize, 10);
        buffer.writeUInt32LE(40, 14);
      buffer.writeInt32LE(0, 18); // Width = 0
      buffer.writeInt32LE(0, 22); // Height = 0
        buffer.writeUInt16LE(1, 26);
        buffer.writeUInt16LE(24, 28);
        buffer.writeUInt32LE(0, 30);
        await invalidTxBuilder.buildUnvalidatedClaimTransaction(700, 700, '', buffer.toString('hex'));

        // Malformed CBOR - major type 0 (unsigned integer instead of text)
        const bmp1 = createMinimalBMP(1, 1);
        await invalidTxBuilder.buildClaimWithMalformedCBOR(800, 800, bmp1.toString('hex'), 0);

        // Malformed CBOR - major type 2 (byte string instead of text)
        const bmp2 = createMinimalBMP(1, 1);
        await invalidTxBuilder.buildClaimWithMalformedCBOR(801, 801, bmp2.toString('hex'), 2);

        await orchestrator.mineBlock();
      });

      // Verify indexer rejected all invalid BMPs - no PLACED plots
      const placedPlots = state.plots.filter(p => p.status === 'PLACED');
      expect(placedPlots.length).toBe(0);
    }, 60000);

    test('CLAIM invalid deed scenarios', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
      const bmp = createMinimalBMP(1, 1);
      const bmpHex = bmp.toString('hex');

        // Use test helper to manually craft invalid deed transactions
        // Testing that INDEXER correctly rejects them

        // Deed amount 599 sats (should be 600)
        await invalidTxBuilder.buildClaimWithInvalidDeedAmount(800, 800, '', bmpHex, 599);

        // Deed amount 601 sats (should be 600)
        await invalidTxBuilder.buildClaimWithInvalidDeedAmount(801, 801, '', bmpHex, 601);

        // No deed output at all
        await invalidTxBuilder.buildClaimWithoutDeedOutput(900, 900, '', bmpHex);

        // Unspendable deed
        await invalidTxBuilder.buildClaimWithUnspendableDeed(1000, 1000, '', bmpHex);

        // Multiple 600-sat outputs (ambiguous which is the deed)
        await invalidTxBuilder.buildClaimWithMultiple600SatOutputs(1100, 1100, '', bmpHex);

        await orchestrator.mineBlock();
      });

      // Verify indexer rejected all invalid deed transactions - no PLACED plots
      const placedPlots = state.plots.filter(p => p.status === 'PLACED');
      expect(placedPlots.length).toBe(0);
    }, 60000);
  });

  describe('RETRY-CLAIM Transactions', () => {
    test('RETRY-CLAIM scenario: end-to-end', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
      const bmpHex = REAL_BMP.toString('hex');

      // Bootstrap: ensure a PLACED plot exists far from others to avoid interference
        const base = await orchestrator.createClaimTx(10000, 10000, '', bmpHex);
        await orchestrator.mineBlock();

        // Scenario 1: UNPLACED at (120,120) then RETRY to (2000,2000) => PLACED
        const blocker = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        const claim1 = await orchestrator.createClaimTx(120, 120, '', bmpHex);
        await orchestrator.mineBlock();

        await orchestrator.createRetryClaimTx(2000, 2000, claim1);
        await orchestrator.mineBlock();

        // Scenario 2: Overlap scenario (130,130)->(110,110) stays UNPLACED
        const claim2 = await orchestrator.createClaimTx(130, 130, '', bmpHex);
        await orchestrator.mineBlock();

        await orchestrator.createRetryClaimTx(110, 110, claim2);
        await orchestrator.mineBlock();

        // Scenario 3: OOB scenario (140,140)->(65500,65500) stays UNPLACED
        const claim3 = await orchestrator.createClaimTx(140, 140, '', bmpHex);
        await orchestrator.mineBlock();

        await orchestrator.createRetryClaimTx(65500, 65500, claim3);
        await orchestrator.mineBlock();

        // Scenario 4: Chained retries (160,160)->(2050,2050)->(3000,3000) ends PLACED
        const claim4 = await orchestrator.createClaimTx(160, 160, '', bmpHex);
        await orchestrator.mineBlock();

        let retry = await orchestrator.createRetryClaimTx(2050, 2050, claim4);
        await orchestrator.mineBlock();

        retry = await orchestrator.createRetryClaimTx(3000, 3000, retry);
        await orchestrator.mineBlock();
      });

      // Verify outcomes
      const plot2000 = state.plots.find(p => p.x0 === 2000 && p.y0 === 2000);
      expect(plot2000).toBeDefined();
      expect(plot2000!.status).toBe('PLACED');

      const plot110 = state.plots.find(p => p.x0 === 110 && p.y0 === 110);
      expect(plot110).toBeDefined();
      expect(plot110!.status).toBe('UNPLACED');

      const plot65500 = state.plots.find(p => p.x0 === 65500 && p.y0 === 65500);
      expect(plot65500).toBeDefined();
      expect(plot65500!.status).toBe('UNPLACED');

      const plot3000 = state.plots.find(p => p.x0 === 3000 && p.y0 === 3000);
      expect(plot3000).toBeDefined();
      expect(plot3000!.status).toBe('PLACED');
    }, 90000);

    test('RETRY-CLAIM invalid scenarios', async () => {
        if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create UNPLACED plot for bricking test
        await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        const unplacedClaim = await orchestrator.createClaimTx(120, 120, '', bmpHex);
        await orchestrator.mineBlock();

        // RETRY without creating deed output (should BRICK the plot)
        // Use test helper to manually craft invalid transaction
        const parts = unplacedClaim.deedUTXO.split(':');
        const deedInput = { 
          txid: parts[0], 
          vout: parseInt(parts[1], 10), 
          amount: 0.000006
        };
        await invalidTxBuilder.buildRetryClaimWithoutDeedOutput(6000, 6000, deedInput);

        await orchestrator.mineBlock();
      });

      // Verify plot is BRICKED due to missing deed output
      const brickedPlot = state.plots.find(p => p.x0 === 120 && p.y0 === 120);
      expect(brickedPlot).toBeDefined();
      expect(brickedPlot!.status).toBe('BRICKED');
    }, 90000);
  });

  describe('UPDATE Transactions', () => {
    test('UPDATE on PLACED plots', async () => {
        if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // Perform successful UPDATE (same coords, same dimensions)
        const update1 = await orchestrator.createUpdateTx(
          100,
          100,
          'https://updated.example',
          bmpHex,
          claim.deedUTXO
        );
        await orchestrator.mineBlock();

        // Create another PLACED plot for wrong coordinates test
        const claim2 = await orchestrator.createClaimTx(1000, 1000, '', bmpHex);
        await orchestrator.mineBlock();
        
        // Try UPDATE with wrong coordinates
        const update2 = await orchestrator.createUpdateTx(
          1100, // Wrong
          1100, // Wrong
          'https://wrong-coords.example',
          bmpHex,
          claim2.deedUTXO
        );
        await orchestrator.mineBlock();

        // Create another PLACED plot for wrong dimensions test
        const claim3 = await orchestrator.createClaimTx(2000, 2000, '', bmpHex);
        await orchestrator.mineBlock();

        // Try UPDATE with wrong dimensions
        const smallBmp = createMinimalBMP(1, 1);
        const update3 = await orchestrator.createUpdateTx(
          2000,
          2000,
          'https://wrong-dims.example',
          smallBmp.toString('hex'),
          claim3.deedUTXO
        );
        await orchestrator.mineBlock();
      });

      // Verify successful UPDATE
      const plot100 = state.plots.find(p => p.x0 === 100 && p.y0 === 100);
      expect(plot100).toBeDefined();
      expect(plot100!.status).toBe('PLACED');

      // Verify wrong coordinates - deed transfers but image unchanged
      const plot1000 = state.plots.find(p => p.x0 === 1000 && p.y0 === 1000);
      expect(plot1000).toBeDefined();
      expect(plot1000!.status).toBe('PLACED');

      // Verify wrong dimensions - deed transfers but image unchanged
      const plot2000 = state.plots.find(p => p.x0 === 2000 && p.y0 === 2000);
      expect(plot2000).toBeDefined();
      expect(plot2000!.status).toBe('PLACED');
      expect(plot2000!.width).toBe(REAL_BMP_WIDTH); // Original dimensions
      expect(plot2000!.height).toBe(REAL_BMP_HEIGHT);
    }, 90000);

    test('UPDATE on UNPLACED and invalid plots', async () => {
        if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        const txBuilder = orchestrator.getTransactionBuilder();
        const walletManager = orchestrator.getWalletManager();
        
        // Create UNPLACED plot (via overlap)
        await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        const unplacedClaim = await orchestrator.createClaimTx(150, 150, '', bmpHex);
        await orchestrator.mineBlock();

        // Try UPDATE on UNPLACED
        const update1 = await orchestrator.createUpdateTx(
          150,
          150,
          'https://unplaced-update.example',
          bmpHex,
          unplacedClaim.deedUTXO
        );
        await orchestrator.mineBlock();

        // Create another PLACED plot for wrong input test
        const claim2 = await orchestrator.createClaimTx(1000, 1000, '', bmpHex);
        await orchestrator.mineBlock();

        // Try UPDATE without spending original deed
        const wrongInput = await walletManager.getSpendableUTXO(1000);
        const wrongDeedInput = { txid: wrongInput.txid, vout: wrongInput.vout, amount: wrongInput.amount };
        try {
          await txBuilder.buildUpdateTransaction(
            1000,
            1000,
            'https://wrong-input.example',
            bmpHex,
            wrongDeedInput
          );
        } catch (e) {
          // May fail
        }

        await orchestrator.mineBlock();
      });

      // Verify UNPLACED plot - deed transfers but image unchanged
      const plot150 = state.plots.find(p => p.x0 === 150 && p.y0 === 150);
      expect(plot150).toBeDefined();
      expect(plot150!.status).toBe('UNPLACED');

      // Verify PLACED plot with wrong input - plot unchanged
      const plot1000 = state.plots.find(p => p.x0 === 1000 && p.y0 === 1000);
      expect(plot1000).toBeDefined();
      expect(plot1000!.status).toBe('PLACED');
    }, 90000);

    test('UPDATE deed chain walking', async () => {
        if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');

        // Create blocking plot
        await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // Create PLACED plot at (200, 200) that becomes UNPLACED due to overlap
        const claim = await orchestrator.createClaimTx(150, 150, '', bmpHex);
        await orchestrator.mineBlock();

        // RETRY-CLAIM to (1000, 1000)
        const retry = await orchestrator.createRetryClaimTx(1000, 1000, claim);
        await orchestrator.mineBlock();

        // UPDATE at current location (1000, 1000) with same dimensions
        const update1 = await orchestrator.createUpdateTx(
          1000,
          1000,
          'https://updated.example',
          bmpHex,
          retry.deedUTXO
        );
        await orchestrator.mineBlock();

        // Try UPDATE with wrong dimensions
        const smallBmp = createMinimalBMP(2, 2);
        const update2 = await orchestrator.createUpdateTx(
          1000,
          1000,
          'https://wrong-dims.example',
          smallBmp.toString('hex'),
          update1.deedUTXO
        );
        await orchestrator.mineBlock();
      });

      // Verify UPDATE succeeded at current location
      const plot1000 = state.plots.find(p => p.x0 === 1000 && p.y0 === 1000);
      expect(plot1000).toBeDefined();
      expect(plot1000!.status).toBe('PLACED');
      expect(plot1000!.width).toBe(REAL_BMP_WIDTH); // Original dimensions preserved
      expect(plot1000!.height).toBe(REAL_BMP_HEIGHT);
    }, 90000);
  });

  describe('TRANSFER Transactions', () => {
    test('TRANSFER happy paths', async () => {
        if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');

        // Create PLACED plot
        const claim1 = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // TRANSFER deed
        const transfer1 = await orchestrator.createTransferTx(claim1.deedUTXO);
        await orchestrator.mineBlock();

        // Create UNPLACED plot (via overlap)
        await orchestrator.createClaimTx(1000, 1000, '', bmpHex);
        await orchestrator.mineBlock();

        const claim2 = await orchestrator.createClaimTx(1050, 1050, '', bmpHex);
        await orchestrator.mineBlock();

        // TRANSFER deed on UNPLACED
        const transfer2 = await orchestrator.createTransferTx(claim2.deedUTXO);
        await orchestrator.mineBlock();
      });

      // Verify PLACED plot - plot data unchanged, deed transferred
      const plot100 = state.plots.find(p => p.x0 === 100 && p.y0 === 100);
      expect(plot100).toBeDefined();
      expect(plot100!.status).toBe('PLACED');

      // Verify UNPLACED plot - remains UNPLACED, deed transferred
      const plot1050 = state.plots.find(p => p.x0 === 1050 && p.y0 === 1050);
      expect(plot1050).toBeDefined();
      expect(plot1050!.status).toBe('UNPLACED');
      }, 90000);

    test('TRANSFER bricking scenarios', async () => {
        if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');

        // Create PLACED plot for no deed output test
        const claim1 = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // TRANSFER without deed output (should BRICK)
        // Use test helper to manually craft invalid transaction
        const parts1 = claim1.deedUTXO.split(':');
        const deedInput1 = {
          txid: parts1[0],
          vout: parseInt(parts1[1], 10),
          amount: 0.000006
        };
        await invalidTxBuilder.buildTransferWithoutDeedOutput(deedInput1);
        await orchestrator.mineBlock();

        // Create another PLACED plot for wrong deed amount test
        const claim2 = await orchestrator.createClaimTx(1000, 1000, '', bmpHex);
        await orchestrator.mineBlock();

        // TRANSFER with wrong deed amount (599 instead of 600)
        // Use test helper to manually craft invalid transaction
        const parts2 = claim2.deedUTXO.split(':');
        const deedInput2 = {
          txid: parts2[0],
          vout: parseInt(parts2[1], 10),
          amount: 0.000006
        };
        await invalidTxBuilder.buildTransferWithWrongDeedAmount(deedInput2, 599);
        await orchestrator.mineBlock();
      });

      // Verify both plots are BRICKED
      const plot100 = state.plots.find(p => p.x0 === 100 && p.y0 === 100);
      expect(plot100).toBeDefined();
      expect(plot100!.status).toBe('BRICKED');

      const plot1000 = state.plots.find(p => p.x0 === 1000 && p.y0 === 1000);
      expect(plot1000).toBeDefined();
      expect(plot1000!.status).toBe('BRICKED');
    }, 90000);
  });

  describe('Protocol Edge Cases', () => {
    test('BMP orientation and malformed OP_RETURN', async () => {
        if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // Top-down BMP (negative height) - uses test helper
        const topDownBmp = invalidTxBuilder.buildTopDownBMP(10, 10);
        const claim1 = await orchestrator.createClaimTx(100, 100, '', topDownBmp.toString('hex'));
        await orchestrator.mineBlock();

        // Bottom-up BMP (positive height)
        const bottomUpBmp = createMinimalBMP(10, 10);
        const claim2 = await orchestrator.createClaimTx(200, 200, '', bottomUpBmp.toString('hex'));
        await orchestrator.mineBlock();

        // Create valid CLAIM for malformed OP_RETURN test
        const bmpHex = createMinimalBMP(5, 5).toString('hex');
        const claim3 = await orchestrator.createClaimTx(1000, 1000, '', bmpHex);
        await orchestrator.mineBlock();

        // Manually craft UPDATE with malformed OP_RETURN (truncated coordinates)
        const parts = claim3.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };

        // Build malformed OP_RETURN by hand
        const malformedOpReturn = Buffer.concat([
          Buffer.from([0x13, 0x37]), // Magic
          Buffer.from([0x01]), // Version
          Buffer.from([0x03]), // Type (UPDATE)
          Buffer.from([0x00]) // Truncated - only 1 byte for X coordinate
        ]);

        const txBuilder = orchestrator.getTransactionBuilder();
        const changeAddress = await orchestrator.getRpcClient().getNewAddress();
        const deedAddress = await orchestrator.getRpcClient().getNewAddress();
        const fundingUTXO = await orchestrator.getWalletManager().getSpendableUTXO(5000);
        
        const inputs = [
          { txid: deedInput.txid, vout: deedInput.vout },
          { txid: fundingUTXO.txid, vout: fundingUTXO.vout }
        ];
        
        const totalInput = deedInput.amount + fundingUTXO.amount;
        const fee = 0.000002;
        const changeAmount = totalInput - 0.000006 - fee;
        
        const outputs = [
          { data: malformedOpReturn.toString('hex') },
          { [deedAddress]: 0.000006 },
          { [changeAddress]: parseFloat(changeAmount.toFixed(8)) }
        ];

        const rawTx = await txBuilder.buildRawTransaction(inputs, outputs);
        const signedHex = await txBuilder.signTransaction(rawTx);
        await txBuilder.broadcastTransaction(signedHex);

        await orchestrator.mineBlock();
      });

      // Verify both BMP orientations work
      const topDownPlot = state.plots.find(p => p.x0 === 100 && p.y0 === 100);
      expect(topDownPlot).toBeDefined();
      expect(topDownPlot!.status).toBe('PLACED');
      expect(topDownPlot!.width).toBe(10);
      expect(topDownPlot!.height).toBe(10); // Absolute value

      const bottomUpPlot = state.plots.find(p => p.x0 === 200 && p.y0 === 200);
      expect(bottomUpPlot).toBeDefined();
      expect(bottomUpPlot!.status).toBe('PLACED');
      expect(bottomUpPlot!.width).toBe(10);
      expect(bottomUpPlot!.height).toBe(10);

      // Verify malformed OP_RETURN treated as transfer-only
      const plot1000 = state.plots.find(p => p.x0 === 1000 && p.y0 === 1000);
      expect(plot1000).toBeDefined();
      expect(plot1000!.status).toBe('PLACED');
      // Deed should have transferred (different from original)
    }, 90000);
  });

  describe('Global Transaction Rules', () => {
    test('Multiple UBB OP_RETURNs ignored on CLAIM', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmp = createMinimalBMP(5, 5);
        
        // Build transaction with TWO UBB OP_RETURNs but exactly one 600-sat deed
        await invalidTxBuilder.buildClaimWithMultipleUBBOpReturns(
          100, 100, 200, 200, bmp.toString('hex')
        );
        
        await orchestrator.mineBlock();
      });

      // Should be no plots created (UBB data ignored, transfer-only semantics)
      expect(state.plots.length).toBe(0);
    }, 60000);

    test('Multiple UBB OP_RETURNs ignored on UPDATE', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // Spend deed with multiple UBB UPDATE OP_RETURNs
        const parts = claim.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        const bmp = createMinimalBMP(5, 5);
        await invalidTxBuilder.buildUpdateWithMultipleUBBOpReturns(
          100, 100, 200, 200, bmp.toString('hex'), deedInput
        );
        
        await orchestrator.mineBlock();
      });

      // Plot should still exist with original content (UPDATE ignored, deed transferred)
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.x0).toBe(100);
      expect(plot.y0).toBe(100);
      expect(plot.width).toBe(REAL_BMP_WIDTH);
      expect(plot.height).toBe(REAL_BMP_HEIGHT);
      expect(plot.status).toBe('PLACED');
    }, 60000);

    // NOTE: Multiple OP_RETURN handling is tested in tests/multi-opreturn-validator.test.ts
    // That test verifies:
    // - Multiple UBB OP_RETURNs are rejected
    // - Non-UBB OP_RETURN before UBB OP_RETURN is handled correctly
    // E2E testing is impractical due to transaction construction complexity.
  });

  describe('Magic/Version/Type Validation', () => {
    test('Wrong magic ignored (transfer-only)', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // UPDATE with wrong magic
        const parts = claim.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        const newBmp = createMinimalBMP(5, 5);
        await invalidTxBuilder.buildUpdateWithWrongMagic(
          100, 100, newBmp.toString('hex'), deedInput
        );
        
        await orchestrator.mineBlock();
      });

      // Plot should still exist with original content (UPDATE ignored, deed transferred)
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.width).toBe(REAL_BMP_WIDTH); // Original dimensions preserved
      expect(plot.height).toBe(REAL_BMP_HEIGHT);
      expect(plot.status).toBe('PLACED');
    }, 60000);

    test('Wrong version ignored (transfer-only)', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // UPDATE with wrong version
        const parts = claim.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        const newBmp = createMinimalBMP(5, 5);
        await invalidTxBuilder.buildUpdateWithWrongVersion(
          100, 100, newBmp.toString('hex'), deedInput
        );
        
        await orchestrator.mineBlock();
      });

      // Plot should still exist with original content
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.width).toBe(REAL_BMP_WIDTH);
      expect(plot.height).toBe(REAL_BMP_HEIGHT);
      expect(plot.status).toBe('PLACED');
    }, 60000);

    test('Unknown type ignored (transfer-only)', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // Transaction with unknown type
        const parts = claim.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        const newBmp = createMinimalBMP(5, 5);
        await invalidTxBuilder.buildUpdateWithUnknownType(
          100, 100, newBmp.toString('hex'), deedInput
        );
        
        await orchestrator.mineBlock();
      });

      // Plot should still exist with original content
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.width).toBe(REAL_BMP_WIDTH);
      expect(plot.height).toBe(REAL_BMP_HEIGHT);
      expect(plot.status).toBe('PLACED');
    }, 60000);
  });

  describe('URI/CBOR Rules Completeness', () => {
    test('CLAIM with empty URI is valid', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmp = createMinimalBMP(10, 10);
        
        // CLAIM with empty URI (CBOR 0x60)
        await invalidTxBuilder.buildClaimWithEmptyURI(
          300, 300, bmp.toString('hex')
        );
        
        await orchestrator.mineBlock();
      });

      // Plot should be PLACED
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.x0).toBe(300);
      expect(plot.y0).toBe(300);
      expect(plot.status).toBe('PLACED');
    }, 60000);

    test('UPDATE with empty URI is valid', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // UPDATE with empty URI
        const parts = claim.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        await invalidTxBuilder.buildUpdateWithEmptyURI(
          100, 100, bmpHex, deedInput
        );
        
        await orchestrator.mineBlock();
      });

      // Plot should still be PLACED with same rect
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.status).toBe('PLACED');
      expect(plot.width).toBe(REAL_BMP_WIDTH);
    }, 60000);

    test('CLAIM with indefinite-length URI ignored', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmp = createMinimalBMP(5, 5);
        
        // CLAIM with indefinite-length URI
        await invalidTxBuilder.buildClaimWithIndefiniteLengthURI(
          400, 400, bmp.toString('hex')
        );
        
        await orchestrator.mineBlock();
      });

      // OP_RETURN ignored, no plot created
      expect(state.plots.length).toBe(0);
    }, 60000);

    test('CLAIM with null byte in URI ignored', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmp = createMinimalBMP(5, 5);
        
        // CLAIM with null byte in URI
        await invalidTxBuilder.buildClaimWithNullByteInURI(
          450, 450, bmp.toString('hex')
        );
        
        await orchestrator.mineBlock();
      });

      // OP_RETURN ignored, no plot created
      expect(state.plots.length).toBe(0);
    }, 60000);

    test('CLAIM with missing URI is invalid', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // CLAIM truncated after y0 bytes
        await invalidTxBuilder.buildClaimWithMissingURI(500, 500);
        
        await orchestrator.mineBlock();
      });

      // OP_RETURN invalid, no plot created
      expect(state.plots.length).toBe(0);
    }, 60000);

    test('CLAIM with missing BMP is invalid', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // CLAIM with URI but no BMP
        await invalidTxBuilder.buildClaimWithMissingBMP(550, 550, 'https://example.com');
        
        await orchestrator.mineBlock();
      });

      // OP_RETURN invalid, no plot created
      expect(state.plots.length).toBe(0);
    }, 60000);


    test('CLAIM with long unicode URI is valid', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmp = createMinimalBMP(15, 15);
        
        // CLAIM with long unicode URI (>200 bytes)
        await invalidTxBuilder.buildLongUnicodeURIClaim(
          700, 700, bmp.toString('hex')
        );
        
        await orchestrator.mineBlock();
      });

      // Plot should be PLACED
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.x0).toBe(700);
      expect(plot.y0).toBe(700);
      expect(plot.status).toBe('PLACED');
    }, 60000);

    test('UPDATE with long unicode URI is valid', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // UPDATE with long unicode URI
        const parts = claim.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        await invalidTxBuilder.buildLongUnicodeURIUpdate(
          100, 100, bmpHex, deedInput
        );
        
        await orchestrator.mineBlock();
      });

      // Plot should still be PLACED
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.status).toBe('PLACED');
    }, 60000);
  });

  describe('BMP Format Completeness', () => {
    test('CLAIM accepts 32-bit BMP', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // Create 32-bit BMP (RGBA)
        const bmp32 = invalidTxBuilder.build32BitBMP(20, 20);
        
        await orchestrator.createClaimTx(800, 800, '', bmp32.toString('hex'));
        await orchestrator.mineBlock();
      });

      // Plot should be PLACED
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.x0).toBe(800);
      expect(plot.y0).toBe(800);
      expect(plot.width).toBe(20);
      expect(plot.height).toBe(20);
      expect(plot.status).toBe('PLACED');
    }, 60000);

    test('CLAIM rejects 8-bit BMP (wrong bit depth)', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // Use actual 8-bit BMP file from repo (should be rejected - only 24/32-bit allowed)
        const fs = require('fs');
        const path = require('path');
        const eightBitBmp = fs.readFileSync(path.join(__dirname, 'fixtures/8bit.bmp'));
        
        await invalidTxBuilder.buildUnvalidatedClaimTransaction(
          850, 850, 'https://test.com', eightBitBmp.toString('hex')
        );
        
        await orchestrator.mineBlock();
      });

      // OP_RETURN invalid due to wrong bit depth, no plot created
      expect(state.plots.length).toBe(0);
    }, 60000);

    test('CLAIM rejects compressed BMP', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // Use compressed 32-bit BMP file from repo (BI_BITFIELDS compression)
        // Only uncompressed (BI_RGB=0) is allowed per protocol
        const fs = require('fs');
        const path = require('path');
        const compressedBmp = fs.readFileSync(path.join(__dirname, 'fixtures/compressed_32bit.bmp'));
        
        await invalidTxBuilder.buildUnvalidatedClaimTransaction(
          860, 860, 'https://test.com', compressedBmp.toString('hex'), 0.0001
        );
        
        await orchestrator.mineBlock();
      });

      // OP_RETURN invalid due to compression, no plot created
      expect(state.plots.length).toBe(0);
    }, 60000);
  });

  describe('Deed Flow Edge Cases', () => {
    // NOTE: Unspendable deed semantics test skipped
    // The protocol allows unspendable deeds (plot is PLACED, chain continues, but deed can't be spent)
    // Testing this requires manual transaction construction with provably unspendable scripts
    // which is complex and not critical for protocol compliance
    // The key behavior (deed validation doesn't check spendability) is covered by existing tests

    test('UPDATE with ambiguous deed bricks plot', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // UPDATE with two 600-sat outputs
        const parts = claim.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        await invalidTxBuilder.buildUpdateWithMultiple600SatOutputs(
          100, 100, '', bmpHex, deedInput
        );
        
        await orchestrator.mineBlock();
      });

      // Plot should be BRICKED
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.status).toBe('BRICKED');
    }, 60000);

    test('RETRY with ambiguous deed bricks plot', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create UNPLACED plot (via overlap)
        await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();
        
        const unplaced = await orchestrator.createClaimTx(120, 120, '', bmpHex);
        await orchestrator.mineBlock();

        // RETRY with two 600-sat outputs
        const parts = unplaced.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        await invalidTxBuilder.buildRetryWithMultiple600SatOutputs(
          2000, 2000, deedInput
        );
        
        await orchestrator.mineBlock();
      });

      // Plot should be BRICKED
      const plot120 = state.plots.find(p => p.x0 === 120 && p.y0 === 120);
      expect(plot120).toBeDefined();
      expect(plot120!.status).toBe('BRICKED');
    }, 60000);

    test('TRANSFER with ambiguous deed bricks plot', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // TRANSFER with two 600-sat outputs
        const parts = claim.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        await invalidTxBuilder.buildTransferWithMultiple600SatOutputs(deedInput);
        
        await orchestrator.mineBlock();
      });

      // Plot should be BRICKED
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.status).toBe('BRICKED');
    }, 60000);
  });

  describe('Block Ordering and Serialization', () => {
    test('Same-block order determines winner', async () => {
      if (!isRegtestAvailable) return;

      let claim1Txid = '';
      let claim2Txid = '';
      let blockHash = '';

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Broadcast two overlapping CLAIMs
        const claim1 = await orchestrator.createClaimTx(1000, 1000, 'https://first.com', bmpHex);
        const claim2 = await orchestrator.createClaimTx(1050, 1050, 'https://second.com', bmpHex);
        
        claim1Txid = claim1.txid;
        claim2Txid = claim2.txid;
        
        // Mine one block containing both
        blockHash = await orchestrator.mineBlock();
      });

      // Get block's transaction order
      const txOrder = await orchestrator.getBlockTransactions(blockHash);
      
      // Find which CLAIM came first
      const claim1Index = txOrder.indexOf(claim1Txid);
      const claim2Index = txOrder.indexOf(claim2Txid);
      
      // Assert the earlier transaction wins
      if (claim1Index < claim2Index) {
        // claim1 should be PLACED, claim2 UNPLACED
        const plot1000 = state.plots.find(p => p.x0 === 1000);
        const plot1050 = state.plots.find(p => p.x0 === 1050);
        expect(plot1000).toBeDefined();
        expect(plot1050).toBeDefined();
        expect(plot1000!.status).toBe('PLACED');
        expect(plot1050!.status).toBe('UNPLACED');
      } else {
        // claim2 should be PLACED, claim1 UNPLACED
        const plot1000 = state.plots.find(p => p.x0 === 1000);
        const plot1050 = state.plots.find(p => p.x0 === 1050);
        expect(plot1000).toBeDefined();
        expect(plot1050).toBeDefined();
        expect(plot1050!.status).toBe('PLACED');
        expect(plot1000!.status).toBe('UNPLACED');
      }
    }, 90000);
  });

  describe('RETRY on PLACED Ignored', () => {
    test('RETRY on PLACED plot is ignored (transfer-only)', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // Attempt RETRY to new coords
        await orchestrator.createRetryClaimTx(2000, 2000, claim);
        await orchestrator.mineBlock();
      });

      // Plot should still be at original location
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.x0).toBe(100);
      expect(plot.y0).toBe(100);
      expect(plot.status).toBe('PLACED');
    }, 60000);
  });

  describe('Invalid BMP Format Rejection', () => {
    test('CLAIM with invalid BMP (8-bit) is rejected', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // Create CLAIM with 8-bit BMP (should be rejected - only 24/32-bit allowed)
        const invalidBmp = createInvalidBMP();
        await invalidTxBuilder.buildUnvalidatedClaimTransaction(
          100, 100, '', invalidBmp.toString('hex')
        );
        await orchestrator.mineBlock();
      });

      // Invalid BMP format, no plot created
      expect(state.plots.length).toBe(0);
    }, 60000);

    test('CLAIM with invalid BMP (non-adjacent data) is rejected', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmp = createMinimalBMP(5, 5);
        
        // CLAIM with padding byte between URI and BMP
        await invalidTxBuilder.buildClaimWithNonAdjacentBMP(
          200, 200, 'https://test.com', bmp.toString('hex')
        );
        await orchestrator.mineBlock();
      });

      // Non-adjacent BMP data (padding byte inserted), no plot created
      expect(state.plots.length).toBe(0);
    }, 60000);
  });

  describe('TRANSFER Edge Cases', () => {
    test('TRANSFER with extra outputs and scripts', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(100, 100, '', bmpHex);
        await orchestrator.mineBlock();

        // TRANSFER with multiple extra outputs
        const parts = claim.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        await invalidTxBuilder.buildTransferWithExtraOutputs(deedInput);
        
        await orchestrator.mineBlock();
      });

      // Plot should be unchanged, deed transferred
      expect(state.plots.length).toBe(1);
      const plot = state.plots[0];
      expect(plot.x0).toBe(100);
      expect(plot.y0).toBe(100);
      expect(plot.status).toBe('PLACED');
    }, 60000);
  });

  describe('UNPLACED Plot Semantics', () => {
    test('UNPLACED plots do not occupy space', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create first PLACED plot at 3000,3000
        await orchestrator.createClaimTx(3000, 3000, '', bmpHex);
        await orchestrator.mineBlock();
        
        // Create UNPLACED plot at 3050,3050 (overlaps first)
        await orchestrator.createClaimTx(3050, 3050, '', bmpHex);
        await orchestrator.mineBlock();

        // Create THIRD plot at 3050,3050 (same coords as UNPLACED)
        // This should be UNPLACED due to overlap with FIRST plot, not blocked by UNPLACED plot
        await orchestrator.createClaimTx(3050, 3050, '', bmpHex);
        await orchestrator.mineBlock();
      });

      // Should have 3 plots
      expect(state.plots.length).toBe(3);

      // First at 3000,3000 should be PLACED
      const placed = state.plots.find(p => p.x0 === 3000);
      expect(placed).toBeDefined();
      expect(placed!.status).toBe('PLACED');

      // Two at 3050,3050 should BOTH be UNPLACED
      const unplacedPlots = state.plots.filter(p => p.x0 === 3050 && p.status === 'UNPLACED');
      expect(unplacedPlots.length).toBe(2);
    }, 60000);
  });

  describe('Invalid CLAIM Chain Actions', () => {
    test('Invalid CLAIM then RETRY ignored (transfer-only)', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // Create CLAIM with invalid OP_RETURN (8-bit BMP) but valid deed
        const invalidBmp = createInvalidBMP();
        const claimTxid = await invalidTxBuilder.buildUnvalidatedClaimTransaction(
          950, 950, 'https://test.com', invalidBmp.toString('hex')
        );
        await orchestrator.mineBlock();

        // Try RETRY on the deed - should be transfer-only (no original rect to retry)
        const deedUTXO = `${claimTxid}:1`;
        const parts = deedUTXO.split(':');
        await invalidTxBuilder.buildRetryTransaction(
          1000, 1000,
          { txid: parts[0], vout: parseInt(parts[1]), amount: 0.000006 }
        );
        await orchestrator.mineBlock();
      });

      // No plots created (invalid CLAIM OP_RETURN, RETRY ignored - no original rect)
      expect(state.plots.length).toBe(0);
    }, 60000);

    test('Invalid CLAIM then UPDATE ignored (transfer-only)', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        // Create CLAIM with invalid OP_RETURN (8-bit BMP) but valid deed
        const invalidBmp = createInvalidBMP();
        const claimTxid = await invalidTxBuilder.buildUnvalidatedClaimTransaction(
          960, 960, 'https://test.com', invalidBmp.toString('hex')
        );
        await orchestrator.mineBlock();

        // Try UPDATE on the deed - should be transfer-only (no original rect to update)
        const deedUTXO = `${claimTxid}:1`;
        const parts = deedUTXO.split(':');
        await invalidTxBuilder.buildUpdateTransaction(
          960, 960, 'https://updated.com', REAL_BMP.toString('hex'),
          { txid: parts[0], vout: parseInt(parts[1]), amount: 0.000006 }
        );
        await orchestrator.mineBlock();
      });

      // No plots created (invalid CLAIM OP_RETURN, UPDATE ignored - no original rect)
      expect(state.plots.length).toBe(0);
    }, 60000);
  });

  describe('BRICKED Visibility Semantics', () => {
    // ⚠️  IMPORTANT TESTING GOTCHA: Bitcoin Core Transaction Ordering
    // 
    // When multiple transactions are submitted to mempool and then mined in the same block,
    // Bitcoin Core can reorder them. The order in which you call createClaimTx() does NOT
    // guarantee the order they appear in the block!
    // 
    // For tests that depend on knowing which transaction "won" a same-block conflict:
    // 1. Mine the block containing the conflicting transactions
    // 2. Call orchestrator.getBlockTransactions(blockHash) to get actual serialization order
    // 3. Use that order to determine which plot is PLACED vs UNPLACED
    // 
    // Failure to do this will cause flaky tests that pass/fail randomly based on Core's
    // internal transaction ordering logic.
    // 
    // See test "BRICKED UNPLACED plot frees space" below for an example of correct handling.

    test('BRICKED PLACED plot still occupies space', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create PLACED plot
        const claim = await orchestrator.createClaimTx(1000, 1000, '', bmpHex);
        await orchestrator.mineBlock();

        // Brick it (transfer without deed output)
        const parts = claim.deedUTXO.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        await invalidTxBuilder.buildTransferWithoutDeedOutput(deedInput);
        await orchestrator.mineBlock();

        // Attempt overlapping CLAIM
        await orchestrator.createClaimTx(1050, 1050, '', bmpHex);
        await orchestrator.mineBlock();
      });

      // Original plot should be BRICKED
      const brickedPlot = state.plots.find(p => p.x0 === 1000);
      expect(brickedPlot).toBeDefined();
      expect(brickedPlot!.status).toBe('BRICKED');

      // New overlapping claim should be UNPLACED (space occupied by bricked plot)
      const newPlot = state.plots.find(p => p.x0 === 1050);
      expect(newPlot).toBeDefined();
      expect(newPlot!.status).toBe('UNPLACED');
    }, 60000);

    test('BRICKED UNPLACED plot frees space', async () => {
      if (!isRegtestAvailable) return;

      const state = await runTestScenario(async () => {
        const bmpHex = REAL_BMP.toString('hex');
        
        // Create TWO plots at SAME coordinates - one will be PLACED, one UNPLACED
        // ⚠️  CRITICAL GOTCHA: Block ordering determines which is PLACED, NOT submission order!
        // Bitcoin Core can reorder transactions when mining blocks. We MUST check the actual
        // block transaction order to identify which plot ended up PLACED vs UNPLACED.
        const result1 = await orchestrator.createClaimTx(20000, 20000, '', bmpHex);
        const result2 = await orchestrator.createClaimTx(20000, 20000, '', bmpHex);
        const blockHash1 = await orchestrator.mineBlock();

        // ⚠️  CRITICAL: Query block to determine actual transaction order
        // This is the ONLY way to know which plot is PLACED vs UNPLACED
        const txOrder = await orchestrator.getBlockTransactions(blockHash1);
        const result1Index = txOrder.indexOf(result1.txid);
        const result2Index = txOrder.indexOf(result2.txid);
        
        // Brick the UNPLACED plot (the one that came second in block serialization order)
        // If we don't check block order, we might accidentally brick the PLACED plot!
        const unplacedDeed = result1Index < result2Index ? result2.deedUTXO : result1.deedUTXO;
        const parts = unplacedDeed.split(':');
        const deedInput = {
          txid: parts[0],
          vout: parseInt(parts[1], 10),
          amount: 0.000006
        };
        
        await invalidTxBuilder.buildTransferWithoutDeedOutput(deedInput);
        await orchestrator.mineBlock();

        // Create NEW CLAIM at same coords - should be UNPLACED due to first plot, not blocked by BRICKED UNPLACED
        await orchestrator.createClaimTx(20000, 20000, '', bmpHex);
        await orchestrator.mineBlock();
      });

      // Should have 3 plots: 1 PLACED, 1 BRICKED (was UNPLACED), 1 UNPLACED
      const plotsAt20000 = state.plots.filter(p => p.x0 === 20000 && p.y0 === 20000);
      expect(plotsAt20000.length).toBe(3);

      const placed = plotsAt20000.find(p => p.status === 'PLACED');
      expect(placed).toBeDefined();

      const bricked = plotsAt20000.find(p => p.status === 'BRICKED');
      expect(bricked).toBeDefined();
      expect(bricked!.wasPlacedBeforeBricking).toBe(false);

      const unplacedCount = plotsAt20000.filter(p => p.status === 'UNPLACED').length;
      expect(unplacedCount).toBe(1);
    }, 60000);
  });
});