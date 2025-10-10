/**
 * Type definitions for the UBB indexer
 */

export interface UBBState {
  blockHash: string;
  parentHash: string;
  blockHeight: number;
  timestamp: number;
  plots: UBBPlot[];
  deedUTXOs: string[]; // Array of "txid:vout" strings
  transactionCount: number;
}

export interface UBBPlot {
  txid: string;
  x0: number;
  y0: number;
  width: number;
  height: number;
  status: 'PLACED' | 'UNPLACED' | 'BRICKED';
  deedUTXO: string; // "txid:vout" format
  imageHash: string; // Hash of the BMP data
  createdAt: number; // Block timestamp when created
  lastUpdated: number; // Block timestamp when last updated
  owner: string; // Address that controls the deed UTXO
  uri?: string; // Optional URI from the OP_RETURN data
  wasPlacedBeforeBricking?: boolean; // True if plot was PLACED when it became BRICKED (for rendering)
}

export interface BlockInfo {
  hash: string;
  parentHash: string;
  height: number;
  timestamp: number;
  transactionCount: number;
}

export interface RouteToTip {
  [parentHash: string]: string; // parentHash -> childHash mapping
}

export interface IndexerConfig {
  dataDir: string;
  blockchainInfoUrl: string;
  maxRetries: number;
  retryDelay: number;
  network?: 'mainnet' | 'testnet' | 'regtest';
  blockSource?: 'api' | 'rpc';
  rpcUrl?: string; // e.g. http://user:password@127.0.0.1:18443
  genesisHash?: string; // UBB genesis block hash - required for StateManager
}

export interface ProcessingResult {
  success: boolean;
  blocksProcessed: number;
  transactionsProcessed: number;
  plotsCreated: number;
  plotsUpdated: number;
  plotsBricked: number;
  errors: string[];
}

export interface DeedUTXO {
  txid: string;
  vout: number;
  value: number;
  address: string;
  plotTxid?: string; // The transaction that created this deed
}
