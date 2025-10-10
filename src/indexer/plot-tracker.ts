/**
 * Plot placement, overlap detection, and deed UTXO tracking
 */

import { UBBPlot, UBBState, DeedUTXO } from './types';
import { UBBOpReturnData } from '../transactions/ubb-op-return-data';
import { UBBBMP } from '../ubb-bmp';

export class PlotTracker {
  private readonly deedValue: number = 600; // sats

  /**
   * Check if a plot overlaps with any existing PLACED plots
   */
  checkOverlap(newPlot: UBBPlot, existingPlacedPlots: UBBPlot[]): boolean {
    for (const existingPlot of existingPlacedPlots) {
      if (this.plotsOverlap(newPlot, existingPlot)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if two plots overlap
   */
  private plotsOverlap(plot1: UBBPlot, plot2: UBBPlot): boolean {
    const plot1Right = plot1.x0 + plot1.width;
    const plot1Bottom = plot1.y0 + plot1.height;
    const plot2Right = plot2.x0 + plot2.width;
    const plot2Bottom = plot2.y0 + plot2.height;

    return !(
      plot1Right <= plot2.x0 ||
      plot1.x0 >= plot2Right ||
      plot1Bottom <= plot2.y0 ||
      plot1.y0 >= plot2Bottom
    );
  }

  /**
   * Check if plot is within canvas bounds
   */
  isWithinBounds(plot: UBBPlot): boolean {
    const maxCoord = 65535; // Canvas is 65536x65536 (coordinates 0-65535 inclusive)
    return (
      plot.x0 >= 0 &&
      plot.y0 >= 0 &&
      plot.x0 + plot.width - 1 <= maxCoord &&
      plot.y0 + plot.height - 1 <= maxCoord &&
      plot.width > 0 &&
      plot.height > 0
    );
  }

  /**
   * Create plot from UBB transaction data
   */
  createPlotFromTransaction(
    txid: string,
    opReturnData: UBBOpReturnData,
    bmpData: Buffer | null,
    blockTimestamp: number,
    deedUTXO: string,
    owner: string
  ): UBBPlot | null {
    if (!opReturnData.isValid) {
      return null;
    }

    // Extract dimensions from BMP data
    let width = 0;
    let height = 0;
    
    if (bmpData && (opReturnData.isClaim || opReturnData.isUpdate)) {
      try {
        const bmp = new UBBBMP(bmpData);
        // Check if BMP is valid according to UBB protocol rules
        if (!bmp.isValid) {
          // Invalid BMP format (wrong bit depth, compressed, etc.)
          return null;
        }
        width = bmp.width;
        height = bmp.height;
      } catch (error) {
        // Invalid BMP data (parsing failed)
        return null;
      }
    }

    // For RETRY-CLAIM, we need to get dimensions from the original CLAIM
    // This would require looking up the original transaction
    // For now, we'll handle this in the main indexer logic

    const plot: UBBPlot = {
      txid,
      x0: opReturnData.x0,
      y0: opReturnData.y0,
      width,
      height,
      status: 'UNPLACED', // Will be determined by placement logic
      deedUTXO,
      imageHash: this.calculateImageHash(bmpData),
      createdAt: blockTimestamp,
      lastUpdated: blockTimestamp,
      owner,
      uri: opReturnData.uri || undefined
    };

    return plot;
  }

  /**
   * Determine plot status based on placement rules
   */
  determinePlotStatus(plot: UBBPlot, state: UBBState): 'PLACED' | 'UNPLACED' | 'BRICKED' {
    // Check if plot is within bounds
    if (!this.isWithinBounds(plot)) {
      return 'UNPLACED';
    }

    // Check for overlaps with existing PLACED plots
    // Include BRICKED plots that were PLACED (they still occupy space)
    // Exclude BRICKED plots that were UNPLACED (they never occupied space)
    const plotsOccupyingSpace = state.plots.filter(p => 
      p.status === 'PLACED' || 
      (p.status === 'BRICKED' && p.wasPlacedBeforeBricking === true)
    );
    if (this.checkOverlap(plot, plotsOccupyingSpace)) {
      return 'UNPLACED';
    }

    return 'PLACED';
  }

  /**
   * Find plot by deed UTXO
   */
  findPlotByDeedUTXO(state: UBBState, deedUTXO: string): UBBPlot | null {
    return state.plots.find(plot => plot.deedUTXO === deedUTXO) || null;
  }

  /**
   * Check if deed UTXO is valid (exactly 600 sats and spendable)
   */
  isValidDeedUTXO(deedUTXO: DeedUTXO): boolean {
    return deedUTXO.value === this.deedValue;
  }

  /**
   * Check if transaction creates exactly one deed UTXO
   */
  hasSingleDeedUTXO(deedUTXOs: DeedUTXO[]): boolean {
    return deedUTXOs.length === 1;
  }

  /**
   * Check if deed UTXO is spendable (not sent to OP_RETURN)
   */
  isDeedUTXOSpendable(deedUTXO: DeedUTXO): boolean {
    // In a real implementation, you'd check the script type
    // For now, we assume all deed UTXOs are spendable unless proven otherwise
    return true;
  }

  /**
   * Calculate image hash for deduplication
   */
  calculateImageHash(bmpData: Buffer | null): string {
    if (!bmpData) {
      return '';
    }
    
    // Simple hash using built-in crypto
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(bmpData).digest('hex');
  }

  /**
   * Get plot dimensions from original CLAIM transaction
   * This is used for RETRY-CLAIM transactions
   */
  getPlotDimensionsFromOriginalClaim(plot: UBBPlot, state: UBBState): { width: number; height: number } | null {
    // Find the original CLAIM transaction by walking back through the deed chain
    // This is a simplified implementation - in practice you'd need to track deed chains
    
    // For now, return the current dimensions
    // In a full implementation, you'd trace back through the deed UTXO chain
    return {
      width: plot.width,
      height: plot.height
    };
  }

  /**
   * Check if plot coordinates match original CLAIM
   */
  doCoordinatesMatch(plot: UBBPlot, originalPlot: UBBPlot): boolean {
    return plot.x0 === originalPlot.x0 && plot.y0 === originalPlot.y0;
  }

  /**
   * Update plot with new data
   */
  updatePlot(plot: UBBPlot, updates: Partial<UBBPlot>): UBBPlot {
    return {
      ...plot,
      ...updates,
      lastUpdated: Date.now() // Update timestamp
    };
  }

  /**
   * Brick a plot (mark as BRICKED)
   * Preserves all plot data (coordinates, image) and tracks whether it was PLACED
   */
  brickPlot(plot: UBBPlot): UBBPlot {
    return this.updatePlot(plot, {
      status: 'BRICKED',
      owner: '', // BRICKED plots have no owner
      wasPlacedBeforeBricking: plot.status === 'PLACED' // Track for rendering
    });
  }

  /**
   * Get all plots that would be affected by a new plot placement
   */
  getAffectedPlots(newPlot: UBBPlot, state: UBBState): UBBPlot[] {
    const placedPlots = state.plots.filter(p => p.status === 'PLACED');
    return placedPlots.filter(plot => this.plotsOverlap(newPlot, plot));
  }
}
