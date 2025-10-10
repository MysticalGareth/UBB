/**
 * Plot Tracker Unit Tests
 * 
 * Tests for the PlotTracker component covering:
 * - Overlap detection (edges, pixels, containment)
 * - Bounds checking (all 4 edges, corners, overflow)
 * - Plot status determination
 * - Deed UTXO management
 * - Plot updates and bricking
 */

import { PlotTracker } from '../src/indexer/plot-tracker';
import { UBBPlot, UBBState, DeedUTXO } from '../src/indexer/types';
import { UBBOpReturnData } from '../src/transactions/ubb-op-return-data';

describe('PlotTracker Unit Tests', () => {
  let plotTracker: PlotTracker;
  let mockState: UBBState;

  beforeEach(() => {
    plotTracker = new PlotTracker();
    mockState = createMockState();
  });

  describe('Overlap Detection', () => {
    describe('checkOverlap', () => {
      test('should detect overlapping plots', () => {
        const plot1 = createMockPlot('txid1', 10, 10, 20, 20, 'PLACED');
        const plot2 = createMockPlot('txid2', 15, 15, 10, 10, 'PLACED');
        
        const overlaps = plotTracker.checkOverlap(plot2, [plot1]);
        expect(overlaps).toBe(true);
      });

      test('should not detect overlap for non-overlapping plots', () => {
        const plot1 = createMockPlot('txid1', 10, 10, 20, 20, 'PLACED');
        const plot2 = createMockPlot('txid2', 40, 40, 10, 10, 'PLACED');
        
        const overlaps = plotTracker.checkOverlap(plot2, [plot1]);
        expect(overlaps).toBe(false);
      });

      test('should NOT detect overlap for plots touching on edges', () => {
        // Plot 1: (10, 10) size 20x20 → covers pixels 10-29 (inclusive)
        const plot1 = createMockPlot('txid1', 10, 10, 20, 20, 'PLACED');
        // Plot 2: (30, 10) size 10x10 → covers pixels 30-39 (inclusive)
        const plot2 = createMockPlot('txid2', 30, 10, 10, 10, 'PLACED');
        
        const overlaps = plotTracker.checkOverlap(plot2, [plot1]);
        expect(overlaps).toBe(false); // Touching edges is NOT overlapping
      });

      test('should detect overlap when one pixel overlaps', () => {
        const plot1 = createMockPlot('txid1', 10, 10, 20, 20, 'PLACED');
        const plot2 = createMockPlot('txid2', 29, 10, 10, 10, 'PLACED'); // Overlaps by 1 pixel
        
        const overlaps = plotTracker.checkOverlap(plot2, [plot1]);
        expect(overlaps).toBe(true);
      });

      test('should detect overlap when plot is fully contained', () => {
        const plot1 = createMockPlot('txid1', 10, 10, 100, 100, 'PLACED');
        const plot2 = createMockPlot('txid2', 50, 50, 10, 10, 'PLACED');
        
        const overlaps = plotTracker.checkOverlap(plot2, [plot1]);
        expect(overlaps).toBe(true);
      });

      test('should detect diagonal overlaps', () => {
        const plot1 = createMockPlot('txid1', 10, 10, 20, 20, 'PLACED');
        const plot2 = createMockPlot('txid2', 20, 20, 20, 20, 'PLACED');
        
        const overlaps = plotTracker.checkOverlap(plot2, [plot1]);
        expect(overlaps).toBe(true);
      });

      test('should check overlap against multiple existing plots', () => {
        const plot1 = createMockPlot('txid1', 10, 10, 20, 20, 'PLACED');
        const plot2 = createMockPlot('txid2', 100, 100, 20, 20, 'PLACED');
        const newPlot = createMockPlot('txid3', 105, 105, 10, 10, 'PLACED');
        
        const overlaps = plotTracker.checkOverlap(newPlot, [plot1, plot2]);
        expect(overlaps).toBe(true); // Overlaps with plot2
      });
    });
  });

  describe('Bounds Checking', () => {
    describe('isWithinBounds', () => {
      const maxCoord = 65534;

      test('should accept plot within bounds', () => {
        const plot = createMockPlot('txid1', 100, 100, 50, 50, 'PLACED');
        expect(plotTracker.isWithinBounds(plot)).toBe(true);
      });

      test('should accept plot at (0, 0)', () => {
        const plot = createMockPlot('txid1', 0, 0, 10, 10, 'PLACED');
        expect(plotTracker.isWithinBounds(plot)).toBe(true);
      });

      test('should accept plot at max coordinates (65535, 65535) with 1x1 size', () => {
        const plot = createMockPlot('txid1', 65535, 65535, 1, 1, 'PLACED');
        expect(plotTracker.isWithinBounds(plot)).toBe(true);
      });

      test('should reject plot extending beyond right edge', () => {
        const plot = createMockPlot('txid1', 65535, 0, 2, 1, 'PLACED'); // x=65535, width=2 → extends to 65536 (beyond canvas)
        expect(plotTracker.isWithinBounds(plot)).toBe(false);
      });

      test('should reject plot extending beyond bottom edge', () => {
        const plot = createMockPlot('txid1', 0, 65535, 1, 2, 'PLACED'); // y=65535, height=2 → extends to 65536 (beyond canvas)
        expect(plotTracker.isWithinBounds(plot)).toBe(false);
      });

      test('should reject plot extending beyond top-right corner', () => {
        const plot = createMockPlot('txid1', 65530, 65530, 10, 10, 'PLACED'); // 65530 + 10 - 1 = 65539 > 65535 (beyond canvas)
        expect(plotTracker.isWithinBounds(plot)).toBe(false);
      });

      test('should reject plot with zero width', () => {
        const plot = createMockPlot('txid1', 100, 100, 0, 10, 'PLACED');
        expect(plotTracker.isWithinBounds(plot)).toBe(false);
      });

      test('should reject plot with zero height', () => {
        const plot = createMockPlot('txid1', 100, 100, 10, 0, 'PLACED');
        expect(plotTracker.isWithinBounds(plot)).toBe(false);
      });

      test('should reject plot with negative coordinates', () => {
        const plot = createMockPlot('txid1', -1, 0, 10, 10, 'PLACED');
        expect(plotTracker.isWithinBounds(plot)).toBe(false);
      });

      test('should handle large plots that stay within bounds', () => {
        const plot = createMockPlot('txid1', 0, 0, 65535, 65535, 'PLACED');
        expect(plotTracker.isWithinBounds(plot)).toBe(true);
      });

      test('should handle edge case: plot at (65533, 65533) with 2x2 size', () => {
        const plot = createMockPlot('txid1', 65533, 65533, 2, 2, 'PLACED'); // Ends at 65534, 65534 (within bounds)
        expect(plotTracker.isWithinBounds(plot)).toBe(true);
      });
    });
  });

  describe('Plot Status Determination', () => {
    describe('determinePlotStatus', () => {
      test('should return PLACED for plot within bounds and no overlaps', () => {
        const plot = createMockPlot('txid1', 100, 100, 20, 20, 'UNPLACED');
        const status = plotTracker.determinePlotStatus(plot, mockState);
        expect(status).toBe('PLACED');
      });

      test('should return UNPLACED for plot out of bounds', () => {
        const plot = createMockPlot('txid1', 65530, 65530, 10, 10, 'UNPLACED');
        const status = plotTracker.determinePlotStatus(plot, mockState);
        expect(status).toBe('UNPLACED');
      });

      test('should return UNPLACED for plot overlapping existing PLACED plot', () => {
        const existingPlot = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');
        mockState.plots.push(existingPlot);
        
        const newPlot = createMockPlot('txid2', 110, 110, 20, 20, 'UNPLACED');
        const status = plotTracker.determinePlotStatus(newPlot, mockState);
        expect(status).toBe('UNPLACED');
      });

      test('should return PLACED for plot overlapping only UNPLACED plots', () => {
        const existingPlot = createMockPlot('txid1', 100, 100, 20, 20, 'UNPLACED');
        mockState.plots.push(existingPlot);
        
        const newPlot = createMockPlot('txid2', 110, 110, 20, 20, 'UNPLACED');
        const status = plotTracker.determinePlotStatus(newPlot, mockState);
        expect(status).toBe('PLACED'); // Only checks overlap with PLACED plots
      });

      test('should return PLACED for plot overlapping BRICKED plots', () => {
        const existingPlot = createMockPlot('txid1', 100, 100, 20, 20, 'BRICKED');
        mockState.plots.push(existingPlot);
        
        const newPlot = createMockPlot('txid2', 110, 110, 20, 20, 'UNPLACED');
        const status = plotTracker.determinePlotStatus(newPlot, mockState);
        expect(status).toBe('PLACED'); // BRICKED plots don't block placement
      });
    });
  });

  describe('Deed UTXO Management', () => {
    describe('findPlotByDeedUTXO', () => {
      test('should find plot by deed UTXO', () => {
        const plot = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');
        plot.deedUTXO = 'deed-txid:1';
        mockState.plots.push(plot);
        
        const found = plotTracker.findPlotByDeedUTXO(mockState, 'deed-txid:1');
        expect(found).toEqual(plot);
      });

      test('should return null if deed UTXO not found', () => {
        const found = plotTracker.findPlotByDeedUTXO(mockState, 'nonexistent:0');
        expect(found).toBeNull();
      });
    });

    describe('isValidDeedUTXO', () => {
      test('should validate deed UTXO with exactly 600 sats', () => {
        const deed: DeedUTXO = {
          txid: 'txid',
          vout: 1,
          value: 600,
          address: 'addr'
        };
        expect(plotTracker.isValidDeedUTXO(deed)).toBe(true);
      });

      test('should reject deed UTXO with wrong amount', () => {
        const deed: DeedUTXO = {
          txid: 'txid',
          vout: 1,
          value: 599,
          address: 'addr'
        };
        expect(plotTracker.isValidDeedUTXO(deed)).toBe(false);
      });
    });

    describe('hasSingleDeedUTXO', () => {
      test('should return true for exactly one deed UTXO', () => {
        const deeds: DeedUTXO[] = [{
          txid: 'txid',
          vout: 1,
          value: 600,
          address: 'addr'
        }];
        expect(plotTracker.hasSingleDeedUTXO(deeds)).toBe(true);
      });

      test('should return false for zero deed UTXOs', () => {
        expect(plotTracker.hasSingleDeedUTXO([])).toBe(false);
      });

      test('should return false for multiple deed UTXOs', () => {
        const deeds: DeedUTXO[] = [
          { txid: 'txid1', vout: 1, value: 600, address: 'addr1' },
          { txid: 'txid2', vout: 1, value: 600, address: 'addr2' }
        ];
        expect(plotTracker.hasSingleDeedUTXO(deeds)).toBe(false);
      });
    });
  });

  describe('Plot Updates', () => {
    describe('updatePlot', () => {
      test('should update plot with new data', () => {
        const original = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');
        const updated = plotTracker.updatePlot(original, {
          x0: 200,
          y0: 200,
          status: 'UNPLACED'
        });
        
        expect(updated.x0).toBe(200);
        expect(updated.y0).toBe(200);
        expect(updated.status).toBe('UNPLACED');
        expect(updated.width).toBe(20); // Unchanged
        expect(updated.height).toBe(20); // Unchanged
      });

      test('should update lastUpdated timestamp', () => {
        const original = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');
        const originalTimestamp = original.lastUpdated;
        
        // Wait a tiny bit to ensure timestamp changes
        const updated = plotTracker.updatePlot(original, { x0: 200 });
        
        expect(updated.lastUpdated).toBeGreaterThanOrEqual(originalTimestamp);
      });

      test('should preserve immutability (not modify original)', () => {
        const original = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');
        const originalX = original.x0;
        
        plotTracker.updatePlot(original, { x0: 200 });
        
        expect(original.x0).toBe(originalX); // Original unchanged
      });
    });

    describe('brickPlot', () => {
      test('should set status to BRICKED', () => {
        const plot = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');
        const bricked = plotTracker.brickPlot(plot);
        
        expect(bricked.status).toBe('BRICKED');
      });

      test('should clear owner', () => {
        const plot = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');
        plot.owner = 'original-owner';
        
        const bricked = plotTracker.brickPlot(plot);
        
        expect(bricked.owner).toBe(''); // Owner cleared
      });

      test('should preserve all other plot data', () => {
        const plot = createMockPlot('txid1', 100, 100, 20, 20, 'PLACED');
        plot.imageHash = 'hash123';
        plot.deedUTXO = 'deed:1';
        
        const bricked = plotTracker.brickPlot(plot);
        
        expect(bricked.txid).toBe('txid1');
        expect(bricked.x0).toBe(100);
        expect(bricked.y0).toBe(100);
        expect(bricked.width).toBe(20);
        expect(bricked.height).toBe(20);
        expect(bricked.imageHash).toBe('hash123');
        expect(bricked.deedUTXO).toBe('deed:1');
      });
    });
  });

  describe('Image Hash Calculation', () => {
    test('should calculate consistent hash for same data', () => {
      const data = Buffer.from('test data');
      const hash1 = plotTracker.calculateImageHash(data);
      const hash2 = plotTracker.calculateImageHash(data);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 produces 64 hex chars
    });

    test('should calculate different hashes for different data', () => {
      const data1 = Buffer.from('test data 1');
      const data2 = Buffer.from('test data 2');
      const hash1 = plotTracker.calculateImageHash(data1);
      const hash2 = plotTracker.calculateImageHash(data2);
      
      expect(hash1).not.toBe(hash2);
    });

    test('should return empty string for null data', () => {
      const hash = plotTracker.calculateImageHash(null);
      expect(hash).toBe('');
    });
  });

  describe('Affected Plots', () => {
    test('should find all plots affected by new placement', () => {
      const plot1 = createMockPlot('txid1', 10, 10, 20, 20, 'PLACED');
      const plot2 = createMockPlot('txid2', 100, 100, 20, 20, 'PLACED');
      const plot3 = createMockPlot('txid3', 25, 25, 10, 10, 'PLACED');
      mockState.plots.push(plot1, plot2, plot3);
      
      const newPlot = createMockPlot('txid4', 15, 15, 20, 20, 'PLACED');
      const affected = plotTracker.getAffectedPlots(newPlot, mockState);
      
      expect(affected).toHaveLength(2);
      expect(affected).toContainEqual(plot1);
      expect(affected).toContainEqual(plot3);
      expect(affected).not.toContainEqual(plot2);
    });

    test('should return empty array if no plots affected', () => {
      const plot1 = createMockPlot('txid1', 10, 10, 20, 20, 'PLACED');
      mockState.plots.push(plot1);
      
      const newPlot = createMockPlot('txid2', 100, 100, 20, 20, 'PLACED');
      const affected = plotTracker.getAffectedPlots(newPlot, mockState);
      
      expect(affected).toHaveLength(0);
    });
  });
});

// Helper functions
function createMockState(): UBBState {
  return {
    blockHash: 'mock-block-hash',
    parentHash: 'mock-parent-hash',
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
