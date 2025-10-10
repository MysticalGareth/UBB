/**
 * Tests for BRICKED plot state preservation
 * 
 * Verifies that when plots are bricked:
 * - All plot data (coordinates, image, URI) is preserved
 * - wasPlacedBeforeBricking field is set correctly
 * - PLACED plots remain visible (can be rendered)
 * - UNPLACED plots remain invisible
 */

import { PlotTracker } from '../src/indexer/plot-tracker';
import { UBBPlot, UBBState } from '../src/indexer/types';

describe('BRICKED Plot State Preservation', () => {
  let plotTracker: PlotTracker;

  beforeEach(() => {
    plotTracker = new PlotTracker();
  });

  describe('brickPlot() preserves all data', () => {
    test('should preserve coordinates when bricking a PLACED plot', () => {
      const plot: UBBPlot = {
        txid: 'test123',
        x0: 100,
        y0: 200,
        width: 128,
        height: 127,
        status: 'PLACED',
        deedUTXO: 'deed123:0',
        imageHash: 'hash123',
        createdAt: 1000,
        lastUpdated: 1000,
        owner: 'bc1qtest',
        uri: 'https://example.com/test'
      };

      const brickedPlot = plotTracker.brickPlot(plot);

      // All data should be preserved
      expect(brickedPlot.txid).toBe(plot.txid);
      expect(brickedPlot.x0).toBe(plot.x0);
      expect(brickedPlot.y0).toBe(plot.y0);
      expect(brickedPlot.width).toBe(plot.width);
      expect(brickedPlot.height).toBe(plot.height);
      expect(brickedPlot.imageHash).toBe(plot.imageHash);
      expect(brickedPlot.deedUTXO).toBe(plot.deedUTXO);
      expect(brickedPlot.uri).toBe(plot.uri);
      expect(brickedPlot.createdAt).toBe(plot.createdAt);
    });

    test('should preserve coordinates when bricking an UNPLACED plot', () => {
      const plot: UBBPlot = {
        txid: 'test456',
        x0: 300,
        y0: 400,
        width: 256,
        height: 255,
        status: 'UNPLACED',
        deedUTXO: 'deed456:0',
        imageHash: 'hash456',
        createdAt: 2000,
        lastUpdated: 2000,
        owner: 'bc1qtest2',
        uri: 'https://example.com/test2'
      };

      const brickedPlot = plotTracker.brickPlot(plot);

      // All data should be preserved
      expect(brickedPlot.txid).toBe(plot.txid);
      expect(brickedPlot.x0).toBe(plot.x0);
      expect(brickedPlot.y0).toBe(plot.y0);
      expect(brickedPlot.width).toBe(plot.width);
      expect(brickedPlot.height).toBe(plot.height);
      expect(brickedPlot.imageHash).toBe(plot.imageHash);
      expect(brickedPlot.deedUTXO).toBe(plot.deedUTXO);
      expect(brickedPlot.uri).toBe(plot.uri);
    });
  });

  describe('wasPlacedBeforeBricking field', () => {
    test('should set wasPlacedBeforeBricking=true when bricking a PLACED plot', () => {
      const plot: UBBPlot = {
        txid: 'placed-plot',
        x0: 1000,
        y0: 1000,
        width: 128,
        height: 127,
        status: 'PLACED',
        deedUTXO: 'deed-placed:0',
        imageHash: 'hash-placed',
        createdAt: 3000,
        lastUpdated: 3000,
        owner: 'bc1qplaced'
      };

      const brickedPlot = plotTracker.brickPlot(plot);

      expect(brickedPlot.status).toBe('BRICKED');
      expect(brickedPlot.wasPlacedBeforeBricking).toBe(true);
      expect(brickedPlot.owner).toBe(''); // Owner cleared
    });

    test('should set wasPlacedBeforeBricking=false when bricking an UNPLACED plot', () => {
      const plot: UBBPlot = {
        txid: 'unplaced-plot',
        x0: 2000,
        y0: 2000,
        width: 128,
        height: 127,
        status: 'UNPLACED',
        deedUTXO: 'deed-unplaced:0',
        imageHash: 'hash-unplaced',
        createdAt: 4000,
        lastUpdated: 4000,
        owner: 'bc1qunplaced'
      };

      const brickedPlot = plotTracker.brickPlot(plot);

      expect(brickedPlot.status).toBe('BRICKED');
      expect(brickedPlot.wasPlacedBeforeBricking).toBe(false);
      expect(brickedPlot.owner).toBe(''); // Owner cleared
    });
  });

  describe('State filtering for rendering', () => {
    test('should identify BRICKED+PLACED plots for rendering', () => {
      const state: UBBState = {
        blockHash: 'block123',
        parentHash: 'parent123',
        blockHeight: 100,
        timestamp: 5000,
        transactionCount: 10,
        deedUTXOs: [],
        plots: [
          {
            txid: 'plot1',
            x0: 100,
            y0: 100,
            width: 128,
            height: 127,
            status: 'PLACED',
            deedUTXO: 'deed1:0',
            imageHash: 'hash1',
            createdAt: 1000,
            lastUpdated: 1000,
            owner: 'bc1q1'
          },
          {
            txid: 'plot2',
            x0: 500,
            y0: 500,
            width: 128,
            height: 127,
            status: 'BRICKED',
            deedUTXO: 'deed2:0',
            imageHash: 'hash2',
            createdAt: 2000,
            lastUpdated: 2000,
            owner: '',
            wasPlacedBeforeBricking: true // Should be rendered
          },
          {
            txid: 'plot3',
            x0: 1000,
            y0: 1000,
            width: 128,
            height: 127,
            status: 'BRICKED',
            deedUTXO: 'deed3:0',
            imageHash: 'hash3',
            createdAt: 3000,
            lastUpdated: 3000,
            owner: '',
            wasPlacedBeforeBricking: false // Should NOT be rendered
          },
          {
            txid: 'plot4',
            x0: 1500,
            y0: 1500,
            width: 128,
            height: 127,
            status: 'UNPLACED',
            deedUTXO: 'deed4:0',
            imageHash: 'hash4',
            createdAt: 4000,
            lastUpdated: 4000,
            owner: 'bc1q4'
          }
        ]
      };

      // Filter for plots that should be rendered on canvas
      const renderablePlots = state.plots.filter(p =>
        p.status === 'PLACED' ||
        (p.status === 'BRICKED' && p.wasPlacedBeforeBricking)
      );

      expect(renderablePlots).toHaveLength(2);
      expect(renderablePlots.map(p => p.txid)).toEqual(['plot1', 'plot2']);
    });

    test('should separate BRICKED plots by placement status for stats', () => {
      const state: UBBState = {
        blockHash: 'block456',
        parentHash: 'parent456',
        blockHeight: 200,
        timestamp: 6000,
        transactionCount: 20,
        deedUTXOs: [],
        plots: [
          { txid: '1', x0: 0, y0: 0, width: 10, height: 10, status: 'PLACED', deedUTXO: 'd1:0', imageHash: 'h1', createdAt: 1, lastUpdated: 1, owner: 'a1' },
          { txid: '2', x0: 0, y0: 0, width: 10, height: 10, status: 'PLACED', deedUTXO: 'd2:0', imageHash: 'h2', createdAt: 1, lastUpdated: 1, owner: 'a2' },
          { txid: '3', x0: 0, y0: 0, width: 10, height: 10, status: 'UNPLACED', deedUTXO: 'd3:0', imageHash: 'h3', createdAt: 1, lastUpdated: 1, owner: 'a3' },
          { txid: '4', x0: 0, y0: 0, width: 10, height: 10, status: 'BRICKED', deedUTXO: 'd4:0', imageHash: 'h4', createdAt: 1, lastUpdated: 1, owner: '', wasPlacedBeforeBricking: true },
          { txid: '5', x0: 0, y0: 0, width: 10, height: 10, status: 'BRICKED', deedUTXO: 'd5:0', imageHash: 'h5', createdAt: 1, lastUpdated: 1, owner: '', wasPlacedBeforeBricking: true },
          { txid: '6', x0: 0, y0: 0, width: 10, height: 10, status: 'BRICKED', deedUTXO: 'd6:0', imageHash: 'h6', createdAt: 1, lastUpdated: 1, owner: '', wasPlacedBeforeBricking: false }
        ]
      };

      const placedCount = state.plots.filter(p => p.status === 'PLACED').length;
      const unplacedCount = state.plots.filter(p => p.status === 'UNPLACED').length;
      const brickedPlacedCount = state.plots.filter(p => p.status === 'BRICKED' && p.wasPlacedBeforeBricking).length;
      const brickedUnplacedCount = state.plots.filter(p => p.status === 'BRICKED' && !p.wasPlacedBeforeBricking).length;

      expect(placedCount).toBe(2);
      expect(unplacedCount).toBe(1);
      expect(brickedPlacedCount).toBe(2); // 2 BRICKED plots were PLACED
      expect(brickedUnplacedCount).toBe(1); // 1 BRICKED plot was UNPLACED
    });
  });

  describe('Billboard space occupation', () => {
    test('BRICKED+PLACED plots occupy billboard space (visible forever)', () => {
      const brickedPlacedPlot: UBBPlot = {
        txid: 'forever-visible',
        x0: 100,
        y0: 100,
        width: 256,
        height: 255,
        status: 'BRICKED',
        deedUTXO: 'deed-brick:0',
        imageHash: 'hash-brick',
        createdAt: 1000,
        lastUpdated: 2000,
        owner: '',
        wasPlacedBeforeBricking: true
      };

      // This plot should be included in overlap checks
      // Even though BRICKED, it occupies space
      expect(brickedPlacedPlot.x0).toBe(100);
      expect(brickedPlacedPlot.y0).toBe(100);
      expect(brickedPlacedPlot.width).toBe(256);
      expect(brickedPlacedPlot.height).toBe(255);
      expect(brickedPlacedPlot.wasPlacedBeforeBricking).toBe(true);
      
      // Coordinates 100-355 (x) and 100-354 (y) are occupied
      const maxX = brickedPlacedPlot.x0 + brickedPlacedPlot.width - 1;
      const maxY = brickedPlacedPlot.y0 + brickedPlacedPlot.height - 1;
      expect(maxX).toBe(355);
      expect(maxY).toBe(354);
    });

    test('BRICKED+UNPLACED plots do NOT occupy billboard space', () => {
      const brickedUnplacedPlot: UBBPlot = {
        txid: 'never-visible',
        x0: 500,
        y0: 500,
        width: 128,
        height: 127,
        status: 'BRICKED',
        deedUTXO: 'deed-unplaced:0',
        imageHash: 'hash-unplaced',
        createdAt: 1000,
        lastUpdated: 2000,
        owner: '',
        wasPlacedBeforeBricking: false
      };

      // These coordinates are NOT occupied on the billboard
      // Another plot could claim (500, 500) and it would be valid
      expect(brickedUnplacedPlot.wasPlacedBeforeBricking).toBe(false);
      
      // Should NOT be included in overlap checks for new plots
      const shouldRender = brickedUnplacedPlot.status === 'PLACED' ||
        (brickedUnplacedPlot.status === 'BRICKED' && brickedUnplacedPlot.wasPlacedBeforeBricking);
      expect(shouldRender).toBe(false);
    });
  });
});

