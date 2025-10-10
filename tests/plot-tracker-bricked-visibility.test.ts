/**
 * Unit tests for BRICKED plot visibility semantics in PlotTracker
 */

import { PlotTracker } from '../src/indexer/plot-tracker';
import { UBBState, UBBPlot } from '../src/indexer/types';

describe('PlotTracker - BRICKED Visibility', () => {
  let plotTracker: PlotTracker;
  let state: UBBState;

  beforeEach(() => {
    plotTracker = new PlotTracker();
    state = createMockState();
  });

  test('BRICKED PLACED plot occupies space', () => {
    // Create a PLACED plot
    const plot1 = createMockPlot('tx1', 1000, 1000, 100, 100, 'PLACED');
    state.plots.push(plot1);

    // Brick the plot (set wasPlacedBeforeBricking = true)
    const bricked = plotTracker.brickPlot(plot1);
    const idx = state.plots.findIndex(p => p.txid === 'tx1');
    state.plots[idx] = bricked;
    
    expect(bricked.status).toBe('BRICKED');
    expect(bricked.wasPlacedBeforeBricking).toBe(true);

    // Try to create an overlapping plot - should be UNPLACED
    const plot2 = createMockPlot('tx2', 1050, 1050, 100, 100, 'PLACED'); // Will be reassessed
    const status2 = plotTracker.determinePlotStatus(plot2, state);
    expect(status2).toBe('UNPLACED');
  });

  test('BRICKED UNPLACED plot does NOT occupy space', () => {
    // Create first PLACED plot at 2000,2000
    const plot1 = createMockPlot('tx1', 2000, 2000, 100, 100, 'PLACED');
    state.plots.push(plot1);

    // Create second plot at SAME coords - should be UNPLACED
    const plot2candidate = createMockPlot('tx2', 2000, 2000, 100, 100, 'PLACED');
    const status2 = plotTracker.determinePlotStatus(plot2candidate, state);
    expect(status2).toBe('UNPLACED');
    
    const plot2 = { ...plot2candidate, status: status2 } as UBBPlot;
    state.plots.push(plot2);

    // Brick the UNPLACED plot (wasPlacedBeforeBricking should be false)
    const unplacedBeforeBricking = plot2.status === 'UNPLACED';
    const bricked = plotTracker.brickPlot(plot2);
    const idx = state.plots.findIndex(p => p.txid === 'tx2');
    state.plots[idx] = bricked;
    
    expect(bricked.status).toBe('BRICKED');
    expect(bricked.wasPlacedBeforeBricking).toBe(false); // It was UNPLACED before bricking

    // Create THIRD plot at same coords
    // Should be UNPLACED because it overlaps with plot1 (PLACED)
    // Should NOT be blocked by plot2 (BRICKED UNPLACED)
    const plot3candidate = createMockPlot('tx3', 2000, 2000, 100, 100, 'PLACED');
    const status3 = plotTracker.determinePlotStatus(plot3candidate, state);
    expect(status3).toBe('UNPLACED'); // Blocked by plot1, not plot2

    // Verify we have the right mix
    const plotsAt2000 = state.plots.filter(p => p.x0 === 2000);
    expect(plotsAt2000.length).toBe(2); // plot1 + plot2 (bricked)
    
    const placed = plotsAt2000.filter(p => p.status === 'PLACED');
    expect(placed.length).toBe(1);
    expect(placed[0].txid).toBe('tx1');
    
    const brickedPlots = plotsAt2000.filter(p => p.status === 'BRICKED');
    expect(brickedPlots.length).toBe(1);
    expect(brickedPlots[0].txid).toBe('tx2');
    expect(brickedPlots[0].wasPlacedBeforeBricking).toBe(false);
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
    uri: '',
    imageHash: 'mock-hash',
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    deedUTXO: `${txid}:0`,
    owner: 'mock-owner',
    wasPlacedBeforeBricking: status === 'PLACED'
  };
}
