/**
 * UBB state management and persistence
 */

import * as fs from 'fs';
import * as path from 'path';
import { UBBState, UBBPlot, BlockInfo, DeedUTXO } from './types';

export class StateManager {
  private readonly dataDir: string;
  private readonly statesDir: string;
  private readonly imagesDir: string;
  private readonly tipSymlinkPath: string;
  private readonly network: string;
  private readonly genesisHash: string;

  constructor(dataDir: string, network: string = 'mainnet', genesisHash: string) {
    this.dataDir = dataDir;
    this.network = network;
    this.genesisHash = genesisHash;
    
    // New structure: data/{network}/v1/{genesisHash}/
    const basePath = path.join(dataDir, network, 'v1', genesisHash);
    this.statesDir = path.join(basePath, 'states');
    this.imagesDir = path.join(basePath, 'images');
    this.tipSymlinkPath = path.join(basePath, 'state_at_tip');
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure all required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [this.dataDir, this.statesDir, this.imagesDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Load UBB state from disk
   */
  loadState(blockHash: string): UBBState | null {
    const statePath = path.join(this.statesDir, blockHash);
    if (!fs.existsSync(statePath)) {
      return null;
    }

    try {
      const stateData = fs.readFileSync(statePath, 'utf8');
      return JSON.parse(stateData);
    } catch (error) {
      throw new Error(`Failed to load state for block ${blockHash}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save UBB state to disk
   */
  saveState(state: UBBState): void {
    const statePath = path.join(this.statesDir, state.blockHash);
    const stateData = JSON.stringify(state, null, 2);
    fs.writeFileSync(statePath, stateData);
  }

  /**
   * Check if state exists for a block
   */
  hasState(blockHash: string): boolean {
    const statePath = path.join(this.statesDir, blockHash);
    return fs.existsSync(statePath);
  }

  /**
   * Create symlink to current tip state
   */
  createTipSymlink(blockHash: string): void {
    const targetPath = path.join('states', blockHash);
    
    // Remove existing symlink if it exists
    if (fs.existsSync(this.tipSymlinkPath)) {
      fs.unlinkSync(this.tipSymlinkPath);
    }
    
    // Create new symlink
    fs.symlinkSync(targetPath, this.tipSymlinkPath);
  }

  /**
   * Save BMP image data
   */
  saveImage(txid: string, bmpData: Buffer): void {
    const imagePath = path.join(this.imagesDir, `${txid}.bmp`);
    fs.writeFileSync(imagePath, bmpData);
  }

  /**
   * Check if image exists
   */
  hasImage(txid: string): boolean {
    const imagePath = path.join(this.imagesDir, `${txid}.bmp`);
    return fs.existsSync(imagePath);
  }

  /**
   * Create initial empty state
   */
  createInitialState(blockInfo: BlockInfo): UBBState {
    return {
      blockHash: blockInfo.hash,
      parentHash: blockInfo.parentHash,
      blockHeight: blockInfo.height,
      timestamp: blockInfo.timestamp,
      plots: [],
      deedUTXOs: [],
      transactionCount: blockInfo.transactionCount
    };
  }

  /**
   * Clone state for processing
   */
  cloneState(state: UBBState): UBBState {
    return {
      blockHash: state.blockHash,
      parentHash: state.parentHash,
      blockHeight: state.blockHeight,
      timestamp: state.timestamp,
      plots: [...state.plots],
      deedUTXOs: [...state.deedUTXOs],
      transactionCount: state.transactionCount
    };
  }

  /**
   * Update state with new block info
   */
  updateStateForBlock(state: UBBState, blockInfo: BlockInfo): UBBState {
    return {
      ...state,
      blockHash: blockInfo.hash,
      parentHash: blockInfo.parentHash,
      blockHeight: blockInfo.height,
      timestamp: blockInfo.timestamp,
      transactionCount: blockInfo.transactionCount
    };
  }

  /**
   * Add plot to state
   */
  addPlot(state: UBBState, plot: UBBPlot): UBBState {
    const newState = this.cloneState(state);
    newState.plots.push(plot);
    return newState;
  }

  /**
   * Update plot in state
   */
  updatePlot(state: UBBState, txid: string, updates: Partial<UBBPlot>): UBBState {
    const newState = this.cloneState(state);
    const plotIndex = newState.plots.findIndex(plot => plot.txid === txid);
    
    if (plotIndex !== -1) {
      newState.plots[plotIndex] = { ...newState.plots[plotIndex], ...updates };
    }
    
    return newState;
  }

  /**
   * Remove plot from state
   */
  removePlot(state: UBBState, txid: string): UBBState {
    const newState = this.cloneState(state);
    newState.plots = newState.plots.filter(plot => plot.txid !== txid);
    return newState;
  }

  /**
   * Add deed UTXO to state
   */
  addDeedUTXO(state: UBBState, deedUTXO: string): UBBState {
    const newState = this.cloneState(state);
    if (!newState.deedUTXOs.includes(deedUTXO)) {
      newState.deedUTXOs.push(deedUTXO);
    }
    return newState;
  }

  /**
   * Remove deed UTXO from state
   */
  removeDeedUTXO(state: UBBState, deedUTXO: string): UBBState {
    const newState = this.cloneState(state);
    newState.deedUTXOs = newState.deedUTXOs.filter(utxo => utxo !== deedUTXO);
    return newState;
  }

  /**
   * Get all PLACED plots
   */
  getPlacedPlots(state: UBBState): UBBPlot[] {
    return state.plots.filter(plot => plot.status === 'PLACED');
  }

  /**
   * Get all UNPLACED plots
   */
  getUnplacedPlots(state: UBBState): UBBPlot[] {
    return state.plots.filter(plot => plot.status === 'UNPLACED');
  }

  /**
   * Get all BRICKED plots
   */
  getBrickedPlots(state: UBBState): UBBPlot[] {
    return state.plots.filter(plot => plot.status === 'BRICKED');
  }

  /**
   * Get plot by transaction ID
   */
  getPlotByTxid(state: UBBState, txid: string): UBBPlot | null {
    return state.plots.find(plot => plot.txid === txid) || null;
  }

  /**
   * Get plots by deed UTXO
   */
  getPlotsByDeedUTXO(state: UBBState, deedUTXO: string): UBBPlot[] {
    return state.plots.filter(plot => plot.deedUTXO === deedUTXO);
  }
}
