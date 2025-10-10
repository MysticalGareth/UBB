/**
 * UBB Blockchain Indexer - Main implementation
 * 
 * Implements the two-phase indexing process:
 * Phase 1: Downward walk to find existing state and build route
 * Phase 2: Process blocks and build UBB states
 */

import * as fs from 'fs';
import * as path from 'path';
import { BitcoinParser } from './bitcoin-parser';
import { StateManager } from './state-manager';
import { PlotTracker } from './plot-tracker';
import { UBBOpReturnData } from '../transactions/ubb-op-return-data';
import { UBBTransaction } from '../transactions/ubb-transaction';
import { BitcoinTransaction, BitcoinInput, BitcoinOutput } from '../bitcoin';
import { 
  UBBState, 
  BlockInfo, 
  RouteToTip, 
  ProcessingResult, 
  IndexerConfig,
  DeedUTXO
} from './types';
import { logInfo, logWarn, logError } from './logger';
import { UBBBMP } from '../ubb-bmp';

export class UBBIndexer {
  private readonly bitcoinParser: BitcoinParser;
  private stateManager: StateManager | null;
  private readonly plotTracker: PlotTracker;
  private readonly config: IndexerConfig;

  constructor(config: IndexerConfig) {
    this.config = config;
    this.bitcoinParser = new BitcoinParser(
      config.dataDir,
      config.blockchainInfoUrl,
      config.network || 'mainnet',
      config.blockSource || 'api',
      config.rpcUrl
    );
    this.stateManager = null; // Created lazily in index() with genesis hash
    this.plotTracker = new PlotTracker();
  }

  /**
   * Get the current chain tip block hash from the block source
   */
  async getTipHash(): Promise<string> {
    return this.bitcoinParser.getTipHash();
  }

  /**
   * Get the block hash at a specific height
   */
  async getBlockHashAtHeight(height: number): Promise<string> {
    return this.bitcoinParser.getBlockHashAtHeight(height);
  }

  /**
   * Main indexing method - implements the two-phase process
   */
  async index(tipHash: string, ubbGenesisHash: string): Promise<ProcessingResult> {
    logInfo(`Starting UBB indexing from tip: ${tipHash}`);
    logInfo(`UBB genesis block: ${ubbGenesisHash}`);

    // Create StateManager with genesis hash (lazy initialization)
    if (!this.stateManager) {
      this.stateManager = new StateManager(
        this.config.dataDir,
        this.config.network || 'mainnet',
        ubbGenesisHash
      );
    }

    // Type assertion: stateManager is guaranteed to be non-null from here
    const stateManager = this.stateManager as StateManager;

    const result: ProcessingResult = {
      success: false,
      blocksProcessed: 0,
      transactionsProcessed: 0,
      plotsCreated: 0,
      plotsUpdated: 0,
      plotsBricked: 0,
      errors: []
    };

    try {
      // Phase 1: Downward walk to find existing state and build route
      logInfo('Phase 1: Finding existing state and building route...');
      let { startingState, routeToTip } = await this.phase1DownwardWalk(tipHash, ubbGenesisHash);
      
      if (!startingState) {
        console.log('No existing state found - creating initial state at UBB genesis');
        // Create initial empty state at the UBB genesis block
        let genesisBlockData = this.bitcoinParser.loadRawBlock(ubbGenesisHash);
        if (!genesisBlockData) {
          console.log(`Downloading UBB genesis block: ${ubbGenesisHash}`);
          genesisBlockData = await this.bitcoinParser.downloadBlock(ubbGenesisHash);
          this.bitcoinParser.saveRawBlock(ubbGenesisHash, genesisBlockData);
        }
        const genesisBlock = this.bitcoinParser.parseBlock(genesisBlockData);
        const genesisBlockHeight = await this.bitcoinParser.getBlockHeight(ubbGenesisHash);
        const genesisBlockInfo = this.bitcoinParser.extractBlockInfo(genesisBlock, genesisBlockHeight);
        startingState = stateManager.createInitialState(genesisBlockInfo);
        
        // Process the genesis block itself for UBB transactions
        console.log('Processing genesis block for UBB transactions...');
        const genesisResult = await this.processBlockTransactions(genesisBlock, startingState);
        startingState = genesisResult.newState;
        result.transactionsProcessed += genesisResult.transactionsProcessed;
        result.plotsCreated += genesisResult.plotsCreated;
        result.plotsUpdated += genesisResult.plotsUpdated;
        result.plotsBricked += genesisResult.plotsBricked;
        result.errors.push(...genesisResult.errors);
        
        // Save the genesis state after processing
        stateManager.saveState(startingState);
      }

      logInfo(`Found existing state at block: ${startingState.blockHash}`);
      logInfo(`Route to tip contains ${Object.keys(routeToTip).length} blocks`);

      // Phase 2: Process blocks and build UBB states
      logInfo('Phase 2: Processing blocks and building UBB states...');
      const processingResult = await this.phase2ProcessBlocks(startingState, routeToTip, tipHash);
      
      // Merge results
      Object.assign(result, processingResult);
      result.success = true;

      logInfo('Indexing completed successfully!');
      logInfo(`Blocks processed: ${result.blocksProcessed}`);
      logInfo(`Transactions processed: ${result.transactionsProcessed}`);
      logInfo(`Plots created: ${result.plotsCreated}`);
      logInfo(`Plots updated: ${result.plotsUpdated}`);
      logInfo(`Plots bricked: ${result.plotsBricked}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logError('Indexing failed:', errorMessage);
      result.errors.push(errorMessage);
    }

    return result;
  }

  /**
   * Phase 1: Walk backwards from chain tip to find existing state and build route
   */
  private async phase1DownwardWalk(
    tipHash: string, 
    ubbGenesisHash: string
  ): Promise<{ startingState: UBBState | null; routeToTip: RouteToTip }> {
    const routeToTip: RouteToTip = {};
    let currentHash = tipHash;
    let startingState: UBBState | null = null;

    while (currentHash !== ubbGenesisHash) {
      // Check if state exists for current block
      if (this.stateManager!.hasState(currentHash)) {
        startingState = this.stateManager!.loadState(currentHash);
        logInfo(`Found existing state at block: ${currentHash}`);
        break;
      }

      // Check if raw block data exists
      let rawBlockData = this.bitcoinParser.loadRawBlock(currentHash);
      
      if (!rawBlockData) {
        logInfo(`Downloading block: ${currentHash}`);
        try {
          rawBlockData = await this.bitcoinParser.downloadBlock(currentHash);
          this.bitcoinParser.saveRawBlock(currentHash, rawBlockData);
        } catch (error) {
          throw new Error(`Failed to download block ${currentHash}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Parse block to get parent hash
      const block = this.bitcoinParser.parseBlock(rawBlockData);
      const blockHeight = await this.bitcoinParser.getBlockHeight(currentHash);
      const blockInfo = this.bitcoinParser.extractBlockInfo(block, blockHeight);
      const parentHash = blockInfo.parentHash;
      
      if (!parentHash) {
        throw new Error(`Block ${currentHash} has no parent hash - reached genesis block`);
      }
      
      // Record route (parent -> child)
      routeToTip[parentHash] = currentHash;
      
      // Move to parent block
      currentHash = parentHash;
    }

    return { startingState, routeToTip };
  }

  /**
   * Phase 2: Process blocks and build UBB states
   */
  private async phase2ProcessBlocks(
    startingState: UBBState,
    routeToTip: RouteToTip,
    tipHash: string
  ): Promise<ProcessingResult> {
    const result: ProcessingResult = {
      success: false,
      blocksProcessed: 0,
      transactionsProcessed: 0,
      plotsCreated: 0,
      plotsUpdated: 0,
      plotsBricked: 0,
      errors: []
    };

    let currentState = startingState;
    let currentHash = startingState.blockHash;

    // Process blocks in chronological order using the route
    while (currentHash !== tipHash) {
      const nextHash = routeToTip[currentHash];
      if (!nextHash) {
        throw new Error(`No route found from ${currentHash} to tip`);
      }

      console.log(`Processing block: ${nextHash}`);

      // Load and parse the next block
      const rawBlockData = this.bitcoinParser.loadRawBlock(nextHash);
      if (!rawBlockData) {
        throw new Error(`Raw block data not found for ${nextHash}`);
      }

      const block = this.bitcoinParser.parseBlock(rawBlockData);
      const blockHeight = await this.bitcoinParser.getBlockHeight(nextHash);
      const blockInfo = this.bitcoinParser.extractBlockInfo(block, blockHeight);

      // Update state with new block info
      currentState = this.stateManager!.updateStateForBlock(currentState, blockInfo);

      // Process all transactions in the block
      const transactionResults = await this.processBlockTransactions(block, currentState);
      
      // Update state with transaction results
      currentState = transactionResults.newState;
      
      // Update counters
      result.blocksProcessed++;
      result.transactionsProcessed += transactionResults.transactionsProcessed;
      result.plotsCreated += transactionResults.plotsCreated;
      result.plotsUpdated += transactionResults.plotsUpdated;
      result.plotsBricked += transactionResults.plotsBricked;
      result.errors.push(...transactionResults.errors);

      // Save state after processing all transactions in the block
      this.stateManager!.saveState(currentState);

      // Move to next block
      currentHash = nextHash;
    }

    // Create symlink to current tip
    this.stateManager!.createTipSymlink(tipHash);

    result.success = true;
    return result;
  }

  /**
   * Process all transactions in a block
   */
  private async processBlockTransactions(
    block: any, // bitcore.Block
    state: UBBState
  ): Promise<{
    newState: UBBState;
    transactionsProcessed: number;
    plotsCreated: number;
    plotsUpdated: number;
    plotsBricked: number;
    errors: string[];
  }> {
    let currentState = state;
    let transactionsProcessed = 0;
    let plotsCreated = 0;
    let plotsUpdated = 0;
    let plotsBricked = 0;
    const errors: string[] = [];

    // Process transactions in block order
    for (const tx of block.transactions) {
      try {
        const txResult = await this.processTransaction(tx, currentState);
        currentState = txResult.newState;
        transactionsProcessed++;
        
        if (txResult.plotCreated) plotsCreated++;
        if (txResult.plotUpdated) plotsUpdated++;
        if (txResult.plotBricked) plotsBricked++;
        
        errors.push(...txResult.errors);
      } catch (error) {
        const errorMessage = `Failed to process transaction ${tx.hash.toString()}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMessage);
        errors.push(errorMessage);
      }
    }

    return {
      newState: currentState,
      transactionsProcessed,
      plotsCreated,
      plotsUpdated,
      plotsBricked,
      errors
    };
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(
    tx: any, // bitcore.Transaction
    state: UBBState
  ): Promise<{
    newState: UBBState;
    plotCreated: boolean;
    plotUpdated: boolean;
    plotBricked: boolean;
    errors: string[];
  }> {
    const txid = tx.hash.toString();
    let newState = state;
    let plotCreated = false;
    let plotUpdated = false;
    let plotBricked = false;
    const errors: string[] = [];

    // Check if this is a UBB transaction
    if (!this.bitcoinParser.isUBBTransaction(tx, state.deedUTXOs)) {
      return { newState, plotCreated, plotUpdated, plotBricked, errors };
    }

    // Check for multiple UBB OP_RETURN outputs (ignores all UBB data, treat as TRANSFER)
    if (this.bitcoinParser.hasMultipleOpReturns(tx)) {
      console.log(`Transaction ${txid} has multiple UBB OP_RETURN outputs - UBB data ignored`);
      // Still need to process deed UTXOs
      const deedResult = await this.processDeedUTXOs(tx, newState, false);
      return {
        newState: deedResult.newState,
        plotCreated: false,
        plotUpdated: false,
        plotBricked: deedResult.plotBricked,
        errors: deedResult.errors
      };
    }

    // Extract OP_RETURN data
    const opReturnData = this.bitcoinParser.extractOpReturnData(tx);
    
    // Find deed UTXOs (needed for both OP_RETURN and TRANSFER transactions)
    const deedUTXOs = this.bitcoinParser.findDeedUTXOs(tx);
    
    // Check if this is a TRANSFER transaction (no OP_RETURN but spends a deed UTXO)
    if (!opReturnData) {
      // This could be a TRANSFER transaction
      // Check if it spends a deed UTXO and creates exactly one new deed UTXO
      let spentDeedUTXO: string | null = null;
      for (const input of tx.inputs) {
        const inputUTXO = `${input.prevTxId.toString('hex')}:${input.outputIndex}`;
        if (state.deedUTXOs.includes(inputUTXO)) {
          spentDeedUTXO = inputUTXO;
          break;
        }
      }
      
      // If no deed UTXO is being spent, this is not a UBB transaction
      if (!spentDeedUTXO) {
        errors.push(`No OP_RETURN data found in UBB transaction ${txid}`);
        return { newState, plotCreated, plotUpdated, plotBricked, errors };
      }
      
      // This is a TRANSFER transaction - validate deed flow
      if (!this.plotTracker.hasSingleDeedUTXO(deedUTXOs)) {
        // Brick the plot - invalid deed spend
        const plot = this.plotTracker.findPlotByDeedUTXO(state, spentDeedUTXO);
        if (plot) {
          const brickedPlot = this.plotTracker.brickPlot(plot);
          newState = this.stateManager!.updatePlot(newState, plot.txid, brickedPlot);
          plotBricked = true;
          console.log(`Bricked plot ${plot.txid} due to invalid deed UTXO spend (must have exactly one 600-sat deed output)`);
        }
        // Remove the spent deed UTXO
        newState = this.stateManager!.removeDeedUTXO(newState, spentDeedUTXO);
        errors.push(`TRANSFER transaction ${txid} must have exactly one deed UTXO of 600 sats`);
        return { newState, plotCreated, plotUpdated, plotBricked, errors };
      }
      
      // Valid TRANSFER - process it
      const deedUTXO = deedUTXOs[0];
      const deedUTXOString = `${deedUTXO.txid}:${deedUTXO.vout}`;
      
      // Remove spent deed, add new deed
      newState = this.stateManager!.removeDeedUTXO(newState, spentDeedUTXO);
      
      const transferResult = await this.processTransferTransaction(tx, deedUTXO, newState, spentDeedUTXO);
      newState = transferResult.newState;
      plotUpdated = transferResult.plotUpdated;
      errors.push(...transferResult.errors);
      
      // Add new deed UTXO
      newState = this.stateManager!.addDeedUTXO(newState, deedUTXOString);
      
      return { newState, plotCreated, plotUpdated, plotBricked, errors };
    }

    // Parse UBB OP_RETURN data
    const ubbOpReturn = new UBBOpReturnData(opReturnData);
    if (!ubbOpReturn.isValid) {
      // Per protocol: "Invalid OP_RETURN payloads are ignored by indexers; the enclosing 
      // Bitcoin transaction is still processed for deed flow."
      // Treat as transfer-only transaction to avoid accidental bricking
      errors.push(`Invalid UBB OP_RETURN data in transaction ${txid}: ${ubbOpReturn.errors.join(', ')} - treating as transfer-only`);
      
      // Check if spending a deed UTXO
      let spentDeedUTXO: string | null = null;
      for (const input of tx.inputs) {
        const inputUTXO = `${input.prevTxId.toString('hex')}:${input.outputIndex}`;
        if (state.deedUTXOs.includes(inputUTXO)) {
          spentDeedUTXO = inputUTXO;
          break;
        }
      }
      
      // If no deed UTXO is being spent, ignore transaction
      if (!spentDeedUTXO) {
        return { newState, plotCreated, plotUpdated, plotBricked, errors };
      }
      
      // Validate deed flow for transfer-only
      if (!this.plotTracker.hasSingleDeedUTXO(deedUTXOs)) {
        // Brick the plot - invalid deed spend
        const plot = this.plotTracker.findPlotByDeedUTXO(state, spentDeedUTXO);
        if (plot) {
          const brickedPlot = this.plotTracker.brickPlot(plot);
          newState = this.stateManager!.updatePlot(newState, plot.txid, brickedPlot);
          plotBricked = true;
          console.log(`Bricked plot ${plot.txid} due to invalid deed UTXO spend in malformed OP_RETURN tx`);
        }
        newState = this.stateManager!.removeDeedUTXO(newState, spentDeedUTXO);
        errors.push(`Malformed OP_RETURN transaction ${txid} must have exactly one deed UTXO of 600 sats`);
        return { newState, plotCreated, plotUpdated, plotBricked, errors };
      }
      
      // Valid deed flow - process as transfer-only
      const deedUTXO = deedUTXOs[0];
      const deedUTXOString = `${deedUTXO.txid}:${deedUTXO.vout}`;
      
      newState = this.stateManager!.removeDeedUTXO(newState, spentDeedUTXO);
      
      const transferResult = await this.processTransferTransaction(tx, deedUTXO, newState, spentDeedUTXO);
      newState = transferResult.newState;
      plotUpdated = transferResult.plotUpdated;
      errors.push(...transferResult.errors);
      
      newState = this.stateManager!.addDeedUTXO(newState, deedUTXOString);
      
      return { newState, plotCreated, plotUpdated, plotBricked, errors };
    }

    // Validate deed flow for OP_RETURN transactions
    if (!this.plotTracker.hasSingleDeedUTXO(deedUTXOs)) {
      errors.push(`Transaction ${txid} must have exactly one deed UTXO of 600 sats`);
      
      // Check if this transaction is spending a deed UTXO without creating a new one
      // If so, brick the plot
      for (const input of tx.inputs) {
        const inputUTXO = `${input.prevTxId.toString('hex')}:${input.outputIndex}`;
        if (state.deedUTXOs.includes(inputUTXO)) {
          // Find and brick the plot associated with this deed
          const plot = this.plotTracker.findPlotByDeedUTXO(state, inputUTXO);
          if (plot) {
            const brickedPlot = this.plotTracker.brickPlot(plot);
            newState = this.stateManager!.updatePlot(newState, plot.txid, brickedPlot);
            plotBricked = true;
            console.log(`Bricked plot ${plot.txid} due to invalid deed UTXO spend`);
          }
          // Remove the spent deed UTXO
          newState = this.stateManager!.removeDeedUTXO(newState, inputUTXO);
        }
      }
      
      return { newState, plotCreated, plotUpdated, plotBricked, errors };
    }

    const deedUTXO = deedUTXOs[0];
    const deedUTXOString = `${deedUTXO.txid}:${deedUTXO.vout}`;

    // Find which deed UTXO is being spent (before we remove it)
    let spentDeedUTXO: string | null = null;
    if (ubbOpReturn.transactionTypeString !== 'CLAIM') {
      for (const input of tx.inputs) {
        const inputUTXO = `${input.prevTxId.toString('hex')}:${input.outputIndex}`;
        if (state.deedUTXOs.includes(inputUTXO)) {
          spentDeedUTXO = inputUTXO;
          // Remove the spent deed UTXO from state
          newState = this.stateManager!.removeDeedUTXO(newState, inputUTXO);
          break;
        }
      }
    }

    // Process based on transaction type
    switch (ubbOpReturn.transactionTypeString) {
      case 'CLAIM':
        const claimResult = await this.processClaimTransaction(tx, ubbOpReturn, deedUTXO, newState);
        newState = claimResult.newState;
        plotCreated = claimResult.plotCreated;
        errors.push(...claimResult.errors);
        // CLAIM always adds new deed (no deed spent)
        newState = this.stateManager!.addDeedUTXO(newState, deedUTXOString);
        break;

      case 'RETRY-CLAIM':
        const retryResult = await this.processRetryClaimTransaction(tx, ubbOpReturn, deedUTXO, newState, spentDeedUTXO);
        newState = retryResult.newState;
        plotUpdated = retryResult.plotUpdated;
        errors.push(...retryResult.errors);
        // Only add new deed if a deed was actually spent
        if (spentDeedUTXO) {
          newState = this.stateManager!.addDeedUTXO(newState, deedUTXOString);
        }
        break;

      case 'UPDATE':
        const updateResult = await this.processUpdateTransaction(tx, ubbOpReturn, deedUTXO, newState, spentDeedUTXO);
        newState = updateResult.newState;
        plotUpdated = updateResult.plotUpdated;
        errors.push(...updateResult.errors);
        // Only add new deed if a deed was actually spent
        if (spentDeedUTXO) {
          newState = this.stateManager!.addDeedUTXO(newState, deedUTXOString);
        }
        break;

      default:
        errors.push(`Unknown transaction type: ${ubbOpReturn.transactionTypeString}`);
    }

    return { newState, plotCreated, plotUpdated, plotBricked, errors };
  }

  /**
   * Process CLAIM transaction
   */
  private async processClaimTransaction(
    tx: any,
    opReturnData: UBBOpReturnData,
    deedUTXO: DeedUTXO,
    state: UBBState
  ): Promise<{
    newState: UBBState;
    plotCreated: boolean;
    errors: string[];
  }> {
    const txid = tx.hash.toString();
    let newState = state;
    let plotCreated = false;
    const errors: string[] = [];

    // Extract BMP data
    const bmpData = opReturnData.bmpData;
    if (!bmpData) {
      errors.push(`CLAIM transaction ${txid} requires BMP data`);
      return { newState, plotCreated, errors };
    }

    // Save BMP image
    this.stateManager!.saveImage(txid, bmpData);

    // Create plot
    const plot = this.plotTracker.createPlotFromTransaction(
      txid,
      opReturnData,
      bmpData,
      Date.now(), // Block timestamp
      `${deedUTXO.txid}:${deedUTXO.vout}`,
      deedUTXO.address
    );

    if (!plot) {
      errors.push(`Failed to create plot for transaction ${txid}`);
      return { newState, plotCreated, errors };
    }

    // Determine plot status
    plot.status = this.plotTracker.determinePlotStatus(plot, newState);

    // Add plot to state
    newState = this.stateManager!.addPlot(newState, plot);
    plotCreated = true;

    console.log(`Created ${plot.status} plot at (${plot.x0}, ${plot.y0}) with size ${plot.width}x${plot.height}`);

    return { newState, plotCreated, errors };
  }

  /**
   * Process RETRY-CLAIM transaction
   */
  private async processRetryClaimTransaction(
    tx: any,
    opReturnData: UBBOpReturnData,
    deedUTXO: DeedUTXO,
    state: UBBState,
    spentDeedUTXO: string | null
  ): Promise<{
    newState: UBBState;
    plotUpdated: boolean;
    errors: string[];
  }> {
    const txid = tx.hash.toString();
    let newState = state;
    let plotUpdated = false;
    const errors: string[] = [];

    if (!spentDeedUTXO) {
      errors.push(`No deed UTXO being spent in RETRY-CLAIM transaction ${txid}`);
      return { newState, plotUpdated, errors };
    }

    // Find existing plot by the spent deed UTXO
    const existingPlot = this.plotTracker.findPlotByDeedUTXO(state, spentDeedUTXO);
    if (!existingPlot) {
      errors.push(`No existing plot found for spent deed UTXO ${spentDeedUTXO}`);
      return { newState, plotUpdated, errors };
    }

    // Can only retry UNPLACED plots
    if (existingPlot.status !== 'UNPLACED') {
      errors.push(`Can only retry UNPLACED plots, found ${existingPlot.status}`);
      return { newState, plotUpdated, errors };
    }

    // Build new deed UTXO string for the updated plot
    const newDeedUTXOString = `${deedUTXO.txid}:${deedUTXO.vout}`;

    // Update coordinates and deed UTXO
    const updatedPlot = this.plotTracker.updatePlot(existingPlot, {
      x0: opReturnData.x0,
      y0: opReturnData.y0,
      deedUTXO: newDeedUTXOString,
      lastUpdated: Date.now()
    });

    // Determine new status
    updatedPlot.status = this.plotTracker.determinePlotStatus(updatedPlot, newState);

    // Update plot in state (keep original txid, update coordinates and deed)
    newState = this.stateManager!.updatePlot(newState, existingPlot.txid, updatedPlot);
    plotUpdated = true;

    console.log(`Retried plot at (${updatedPlot.x0}, ${updatedPlot.y0}) - status: ${updatedPlot.status}`);

    return { newState, plotUpdated, errors };
  }

  /**
   * Process UPDATE transaction
   */
  private async processUpdateTransaction(
    tx: any,
    opReturnData: UBBOpReturnData,
    deedUTXO: DeedUTXO,
    state: UBBState,
    spentDeedUTXO: string | null
  ): Promise<{
    newState: UBBState;
    plotUpdated: boolean;
    errors: string[];
  }> {
    const txid = tx.hash.toString();
    let newState = state;
    let plotUpdated = false;
    const errors: string[] = [];

    if (!spentDeedUTXO) {
      errors.push(`No deed UTXO being spent in UPDATE transaction ${txid}`);
      return { newState, plotUpdated, errors };
    }

    // Find existing plot by the spent deed UTXO (not the new one)
    const existingPlot = this.plotTracker.findPlotByDeedUTXO(state, spentDeedUTXO);
    if (!existingPlot) {
      errors.push(`No existing plot found for spent deed UTXO ${spentDeedUTXO}`);
      return { newState, plotUpdated, errors };
    }

    // Check if plot is PLACED (only PLACED plots can be updated)
    if (existingPlot.status !== 'PLACED') {
      errors.push(`Can only UPDATE PLACED plots, found ${existingPlot.status}`);
      // Deed still transfers even if plot is not PLACED
      const newDeedUTXOString = `${deedUTXO.txid}:${deedUTXO.vout}`;
      const updatedPlot = this.plotTracker.updatePlot(existingPlot, {
        deedUTXO: newDeedUTXOString,
        lastUpdated: Date.now()
      });
      newState = this.stateManager!.updatePlot(newState, existingPlot.txid, updatedPlot);
      return { newState, plotUpdated, errors };
    }

    // Check if coordinates and dimensions match original CLAIM
    const coordsMatch = opReturnData.x0 === existingPlot.x0 && opReturnData.y0 === existingPlot.y0;
    
    // Extract new BMP data to check dimensions
    const bmpData = opReturnData.bmpData;
    if (!bmpData) {
      errors.push(`UPDATE transaction ${txid} requires BMP data`);
      // Deed still transfers even if UPDATE is invalid
      return { newState, plotUpdated, errors };
    }

    // Parse BMP to check dimensions
    const bmp = new UBBBMP(bmpData);
    const dimsMatch = bmp.isValid && bmp.width === existingPlot.width && bmp.height === existingPlot.height;

    if (!coordsMatch || !dimsMatch) {
      errors.push(`UPDATE coordinates/dimensions must match original CLAIM (coords: ${coordsMatch}, dims: ${dimsMatch})`);
      // Deed transfers but image doesn't update
      // Just update the deed UTXO
      const newDeedUTXOString = `${deedUTXO.txid}:${deedUTXO.vout}`;
      const updatedPlot = this.plotTracker.updatePlot(existingPlot, {
        deedUTXO: newDeedUTXOString,
        lastUpdated: Date.now()
      });
      newState = this.stateManager!.updatePlot(newState, existingPlot.txid, updatedPlot);
      return { newState, plotUpdated, errors };
    }

    // Valid UPDATE - save new image and update plot
    this.stateManager!.saveImage(existingPlot.txid, bmpData);

    const newDeedUTXOString = `${deedUTXO.txid}:${deedUTXO.vout}`;
    const updatedPlot = this.plotTracker.updatePlot(existingPlot, {
      imageHash: this.plotTracker.calculateImageHash(bmpData),
      deedUTXO: newDeedUTXOString,
      lastUpdated: Date.now()
    });

    // Update plot in state (keep original txid)
    newState = this.stateManager!.updatePlot(newState, existingPlot.txid, updatedPlot);
    plotUpdated = true;

    console.log(`Updated plot at (${updatedPlot.x0}, ${updatedPlot.y0}) with new image`);

    return { newState, plotUpdated, errors };
  }

  /**
   * Process TRANSFER transaction
   */
  private async processTransferTransaction(
    tx: any,
    deedUTXO: DeedUTXO,
    state: UBBState,
    spentDeedUTXO: string | null
  ): Promise<{
    newState: UBBState;
    plotUpdated: boolean;
    errors: string[];
  }> {
    let newState = state;
    let plotUpdated = false;
    const errors: string[] = [];

    // TRANSFER transactions don't have OP_RETURN data
    // They just transfer ownership of the deed UTXO
    // The plot remains unchanged, only the owner changes

    if (!spentDeedUTXO) {
      errors.push(`TRANSFER transaction must spend a deed UTXO`);
      return { newState, plotUpdated, errors };
    }

    // Find the plot associated with the spent deed UTXO
    const existingPlot = this.plotTracker.findPlotByDeedUTXO(state, spentDeedUTXO);
    if (!existingPlot) {
      errors.push(`No plot found for deed UTXO ${spentDeedUTXO}`);
      return { newState, plotUpdated, errors };
    }

    // Don't transfer bricked plots
    if (existingPlot.status === 'BRICKED') {
      console.log(`Cannot TRANSFER BRICKED plot ${existingPlot.txid}`);
      return { newState, plotUpdated, errors };
    }

    // Update the plot's deed UTXO
    const newDeedUTXOString = `${deedUTXO.txid}:${deedUTXO.vout}`;
    const updatedPlot = this.plotTracker.updatePlot(existingPlot, {
      deedUTXO: newDeedUTXOString,
      lastUpdated: Date.now()
    });
    
    newState = this.stateManager!.updatePlot(newState, existingPlot.txid, updatedPlot);
    plotUpdated = true;

    console.log(`Processed TRANSFER transaction for plot ${existingPlot.txid}, new deed UTXO: ${newDeedUTXOString}`);

    return { newState, plotUpdated, errors };
  }

  /**
   * Process deed UTXOs for non-UBB transactions or bricked transactions
   */
  private async processDeedUTXOs(
    tx: any,
    state: UBBState,
    isBricked: boolean
  ): Promise<{
    newState: UBBState;
    plotBricked: boolean;
    errors: string[];
  }> {
    let newState = state;
    let plotBricked = false;
    const errors: string[] = [];

    // Find deed UTXOs
    const deedUTXOs = this.bitcoinParser.findDeedUTXOs(tx);
    
    if (isBricked || !this.plotTracker.hasSingleDeedUTXO(deedUTXOs)) {
      // Brick all plots that use these deed UTXOs
      for (const deedUTXO of deedUTXOs) {
        const deedUTXOString = `${deedUTXO.txid}:${deedUTXO.vout}`;
        const plots = this.stateManager!.getPlotsByDeedUTXO(state, deedUTXOString);
        
        for (const plot of plots) {
          const brickedPlot = this.plotTracker.brickPlot(plot);
          newState = this.stateManager!.updatePlot(newState, plot.txid, brickedPlot);
          plotBricked = true;
          console.log(`Bricked plot ${plot.txid} due to invalid deed UTXO usage`);
        }
      }
    }

    return { newState, plotBricked, errors };
  }
}
