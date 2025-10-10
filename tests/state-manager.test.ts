/**
 * State Manager Unit Tests
 * 
 * Tests for the StateManager component covering:
 * - State persistence and loading
 * - State creation from genesis
 * - Adding/removing plots
 * - Adding/removing deed UTXOs
 * - Updating plots
 * - State immutability
 * - Tip symlink management
 */

import * as fs from 'fs';
import * as path from 'path';
import { StateManager } from '../src/indexer/state-manager';
import { UBBState, UBBPlot, BlockInfo } from '../src/indexer/types';

describe('StateManager Unit Tests', () => {
  let stateManager: StateManager;
  let tempDir: string;
  const genesisHash = 'test-genesis-hash';

  beforeEach(() => {
    // Create temporary directory for tests
    tempDir = path.join(__dirname, '..', 'test-data', `state-test-${Date.now()}`);
    stateManager = new StateManager(tempDir, 'testnet', genesisHash);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Initialization and Directory Creation', () => {
    test('should create required directories on initialization', () => {
      const statesDir = path.join(tempDir, 'testnet', 'v1', genesisHash, 'states');
      const imagesDir = path.join(tempDir, 'testnet', 'v1', genesisHash, 'images');
      
      expect(fs.existsSync(statesDir)).toBe(true);
      expect(fs.existsSync(imagesDir)).toBe(true);
    });
  });

  describe('Initial State Creation', () => {
    test('should create initial empty state', () => {
      const blockInfo: BlockInfo = {
        hash: 'block-hash-1',
        parentHash: 'parent-hash-0',
        height: 100,
        timestamp: 1234567890,
        transactionCount: 1
      };

      const state = stateManager.createInitialState(blockInfo);

      expect(state.blockHash).toBe('block-hash-1');
      expect(state.parentHash).toBe('parent-hash-0');
      expect(state.blockHeight).toBe(100);
      expect(state.timestamp).toBe(1234567890);
      expect(state.plots).toEqual([]);
      expect(state.deedUTXOs).toEqual([]);
      expect(state.transactionCount).toBe(1);
    });
  });

  describe('State Persistence', () => {
    test('should save and load state', () => {
      const state: UBBState = createMockState('block-hash-1');

      // Save state
      stateManager.saveState(state);

      // Load state
      const loadedState = stateManager.loadState('block-hash-1');

      expect(loadedState).toEqual(state);
    });

    test('should return null when loading non-existent state', () => {
      const loadedState = stateManager.loadState('non-existent-hash');
      expect(loadedState).toBeNull();
    });

    test('should check if state exists', () => {
      const state: UBBState = createMockState('block-hash-2');
      
      expect(stateManager.hasState('block-hash-2')).toBe(false);
      
      stateManager.saveState(state);
      
      expect(stateManager.hasState('block-hash-2')).toBe(true);
    });

    test('should handle loading state with plots', () => {
      const state: UBBState = createMockState('block-hash-3');
      state.plots.push(createMockPlot('txid1', 100, 100, 20, 20, 'PLACED'));
      state.plots.push(createMockPlot('txid2', 200, 200, 30, 30, 'UNPLACED'));

      stateManager.saveState(state);
      const loadedState = stateManager.loadState('block-hash-3');

      expect(loadedState?.plots).toHaveLength(2);
      expect(loadedState?.plots[0]).toEqual(state.plots[0]);
      expect(loadedState?.plots[1]).toEqual(state.plots[1]);
    });
  });

  describe('State Cloning', () => {
    test('should clone state without modifying original', () => {
      const original: UBBState = createMockState('block-hash-4');
      original.plots.push(createMockPlot('txid1', 100, 100, 20, 20, 'PLACED'));

      const cloned = stateManager.cloneState(original);

      // Modify cloned state
      cloned.blockHash = 'modified-hash';
      cloned.plots.push(createMockPlot('txid2', 200, 200, 30, 30, 'PLACED'));

      // Original should be unchanged
      expect(original.blockHash).toBe('block-hash-4');
      expect(original.plots).toHaveLength(1);
      
      // Cloned should be modified
      expect(cloned.blockHash).toBe('modified-hash');
      expect(cloned.plots).toHaveLength(2);
    });
  });

  describe('Block Updates', () => {
    test('should update state with new block info', () => {
      const state: UBBState = createMockState('block-hash-5');
      state.plots.push(createMockPlot('txid1', 100, 100, 20, 20, 'PLACED'));

      const newBlockInfo: BlockInfo = {
        hash: 'block-hash-6',
        parentHash: 'block-hash-5',
        height: 101,
        timestamp: 1234567900,
        transactionCount: 5
      };

      const updatedState = stateManager.updateStateForBlock(state, newBlockInfo);

      expect(updatedState.blockHash).toBe('block-hash-6');
      expect(updatedState.parentHash).toBe('block-hash-5');
      expect(updatedState.blockHeight).toBe(101);
      expect(updatedState.timestamp).toBe(1234567900);
      expect(updatedState.transactionCount).toBe(5);
      expect(updatedState.plots).toHaveLength(1); // Plots preserved
    });
  });

  describe('Plot Management', () => {
    test('should add plot to state', () => {
      const state: UBBState = createMockState('block-hash-7');
      const plot = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');

      const newState = stateManager.addPlot(state, plot);

      expect(newState.plots).toHaveLength(1);
      expect(newState.plots[0]).toEqual(plot);
      expect(state.plots).toHaveLength(0); // Original unchanged
    });

    test('should update plot in state', () => {
      const state: UBBState = createMockState('block-hash-8');
      const plot = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');
      state.plots.push(plot);

      const updates: Partial<UBBPlot> = {
        x0: 200,
        y0: 200,
        status: 'UNPLACED'
      };

      const newState = stateManager.updatePlot(state, 'txid1', updates);

      expect(newState.plots).toHaveLength(1);
      expect(newState.plots[0].x0).toBe(200);
      expect(newState.plots[0].y0).toBe(200);
      expect(newState.plots[0].status).toBe('UNPLACED');
      expect(newState.plots[0].width).toBe(20); // Unchanged
      expect(state.plots[0].x0).toBe(100); // Original unchanged
    });

    test('should not modify state when updating non-existent plot', () => {
      const state: UBBState = createMockState('block-hash-9');
      const plot = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');
      state.plots.push(plot);

      const newState = stateManager.updatePlot(state, 'non-existent-txid', { x0: 999 });

      expect(newState.plots).toHaveLength(1);
      expect(newState.plots[0].x0).toBe(100); // Unchanged
    });

    test('should remove plot from state', () => {
      const state: UBBState = createMockState('block-hash-10');
      state.plots.push(createMockPlot('txid1', 100, 100, 20, 20, 'PLACED'));
      state.plots.push(createMockPlot('txid2', 200, 200, 30, 30, 'PLACED'));

      const newState = stateManager.removePlot(state, 'txid1');

      expect(newState.plots).toHaveLength(1);
      expect(newState.plots[0].txid).toBe('txid2');
      expect(state.plots).toHaveLength(2); // Original unchanged
    });
  });

  describe('Deed UTXO Management', () => {
    test('should add deed UTXO to state', () => {
      const state: UBBState = createMockState('block-hash-11');

      const newState = stateManager.addDeedUTXO(state, 'txid1:0');

      expect(newState.deedUTXOs).toHaveLength(1);
      expect(newState.deedUTXOs[0]).toBe('txid1:0');
      expect(state.deedUTXOs).toHaveLength(0); // Original unchanged
    });

    test('should not add duplicate deed UTXO', () => {
      const state: UBBState = createMockState('block-hash-12');
      state.deedUTXOs.push('txid1:0');

      const newState = stateManager.addDeedUTXO(state, 'txid1:0');

      expect(newState.deedUTXOs).toHaveLength(1);
      expect(newState.deedUTXOs[0]).toBe('txid1:0');
    });

    test('should remove deed UTXO from state', () => {
      const state: UBBState = createMockState('block-hash-13');
      state.deedUTXOs.push('txid1:0', 'txid2:1', 'txid3:2');

      const newState = stateManager.removeDeedUTXO(state, 'txid2:1');

      expect(newState.deedUTXOs).toHaveLength(2);
      expect(newState.deedUTXOs).toContain('txid1:0');
      expect(newState.deedUTXOs).toContain('txid3:2');
      expect(newState.deedUTXOs).not.toContain('txid2:1');
      expect(state.deedUTXOs).toHaveLength(3); // Original unchanged
    });
  });

  describe('Plot Queries', () => {
    let state: UBBState;

    beforeEach(() => {
      state = createMockState('block-hash-14');
      state.plots.push(createMockPlot('txid1', 100, 100, 20, 20, 'PLACED'));
      state.plots.push(createMockPlot('txid2', 200, 200, 30, 30, 'UNPLACED'));
      state.plots.push(createMockPlot('txid3', 300, 300, 40, 40, 'BRICKED'));
      state.plots.push(createMockPlot('txid4', 400, 400, 50, 50, 'PLACED'));
    });

    test('should get all PLACED plots', () => {
      const placedPlots = stateManager.getPlacedPlots(state);
      
      expect(placedPlots).toHaveLength(2);
      expect(placedPlots[0].txid).toBe('txid1');
      expect(placedPlots[1].txid).toBe('txid4');
    });

    test('should get all UNPLACED plots', () => {
      const unplacedPlots = stateManager.getUnplacedPlots(state);
      
      expect(unplacedPlots).toHaveLength(1);
      expect(unplacedPlots[0].txid).toBe('txid2');
    });

    test('should get all BRICKED plots', () => {
      const brickedPlots = stateManager.getBrickedPlots(state);
      
      expect(brickedPlots).toHaveLength(1);
      expect(brickedPlots[0].txid).toBe('txid3');
    });

    test('should get plot by transaction ID', () => {
      const plot = stateManager.getPlotByTxid(state, 'txid2');
      
      expect(plot).not.toBeNull();
      expect(plot?.txid).toBe('txid2');
      expect(plot?.status).toBe('UNPLACED');
    });

    test('should return null for non-existent transaction ID', () => {
      const plot = stateManager.getPlotByTxid(state, 'non-existent');
      expect(plot).toBeNull();
    });

    test('should get plots by deed UTXO', () => {
      state.plots[0].deedUTXO = 'deed1:0';
      state.plots[1].deedUTXO = 'deed2:0';
      state.plots[2].deedUTXO = 'deed1:0'; // Same deed as plot 0
      
      const plots = stateManager.getPlotsByDeedUTXO(state, 'deed1:0');
      
      expect(plots).toHaveLength(2);
      expect(plots[0].txid).toBe('txid1');
      expect(plots[1].txid).toBe('txid3');
    });
  });

  describe('Image Management', () => {
    test('should save and check image existence', () => {
      const txid = 'test-txid-123';
      const bmpData = Buffer.from('fake BMP data');

      expect(stateManager.hasImage(txid)).toBe(false);

      stateManager.saveImage(txid, bmpData);

      expect(stateManager.hasImage(txid)).toBe(true);

      // Verify file was saved
      const imagePath = path.join(tempDir, 'testnet', 'v1', genesisHash, 'images', `${txid}.bmp`);
      expect(fs.existsSync(imagePath)).toBe(true);
      
      const savedData = fs.readFileSync(imagePath);
      expect(savedData).toEqual(bmpData);
    });
  });

  describe('Tip Symlink Management', () => {
    test('should create tip symlink', () => {
      const state: UBBState = createMockState('block-hash-15');
      stateManager.saveState(state);

      stateManager.createTipSymlink('block-hash-15');

      const symlinkPath = path.join(tempDir, 'testnet', 'v1', genesisHash, 'state_at_tip');
      expect(fs.existsSync(symlinkPath)).toBe(true);
      
      // Verify it's a symlink pointing to the right place
      const stats = fs.lstatSync(symlinkPath);
      expect(stats.isSymbolicLink()).toBe(true);
    });

    test('should update tip symlink when called multiple times', () => {
      const state1: UBBState = createMockState('block-hash-16');
      const state2: UBBState = createMockState('block-hash-17');
      
      stateManager.saveState(state1);
      stateManager.saveState(state2);

      stateManager.createTipSymlink('block-hash-16');
      const symlinkPath = path.join(tempDir, 'testnet', 'v1', genesisHash, 'state_at_tip');
      expect(fs.existsSync(symlinkPath)).toBe(true);

      // Update to new tip
      stateManager.createTipSymlink('block-hash-17');
      expect(fs.existsSync(symlinkPath)).toBe(true);
      
      // Should still be a valid symlink
      const stats = fs.lstatSync(symlinkPath);
      expect(stats.isSymbolicLink()).toBe(true);
    });
  });

  describe('State Immutability', () => {
    test('should not modify original state when adding plot', () => {
      const state: UBBState = createMockState('block-hash-18');
      const originalPlotsLength = state.plots.length;

      const newState = stateManager.addPlot(state, createMockPlot('txid1', 100, 100, 20, 20, 'PLACED'));

      expect(state.plots).toHaveLength(originalPlotsLength);
      expect(newState.plots).toHaveLength(originalPlotsLength + 1);
      expect(state).not.toBe(newState); // Different objects
    });

    test('should not modify original state when adding deed UTXO', () => {
      const state: UBBState = createMockState('block-hash-19');
      const originalDeedsLength = state.deedUTXOs.length;

      const newState = stateManager.addDeedUTXO(state, 'txid1:0');

      expect(state.deedUTXOs).toHaveLength(originalDeedsLength);
      expect(newState.deedUTXOs).toHaveLength(originalDeedsLength + 1);
    });

    test('should not share array references between states', () => {
      const state: UBBState = createMockState('block-hash-20');
      state.plots.push(createMockPlot('txid1', 100, 100, 20, 20, 'PLACED'));

      const newState = stateManager.cloneState(state);
      newState.plots.push(createMockPlot('txid2', 200, 200, 30, 30, 'PLACED'));

      expect(state.plots).toHaveLength(1);
      expect(newState.plots).toHaveLength(2);
      expect(state.plots).not.toBe(newState.plots); // Different array references
    });
  });
});

// Helper functions
function createMockState(blockHash: string): UBBState {
  return {
    blockHash,
    parentHash: 'parent-hash',
    blockHeight: 100,
    timestamp: Date.now(),
    plots: [],
    deedUTXOs: [],
    transactionCount: 0
  };
}

function createMockPlot(
  txid: string,
  x0: number,
  y0: number,
  width: number,
  height: number,
  status: 'PLACED' | 'UNPLACED' | 'BRICKED'
): UBBPlot {
  return {
    txid,
    x0,
    y0,
    width,
    height,
    status,
    deedUTXO: `${txid}:1`,
    imageHash: 'mock-hash',
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    owner: 'mock-owner'
  };
}
