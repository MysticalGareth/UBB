export interface WebServerConfig {
  environment: 'mainnet' | 'testnet' | 'regtest';
  genesisHash: string;
  port?: number;
}

export interface PlotState {
  txid: string;
  x0: number;
  y0: number;
  width: number;
  height: number;
  status: string;
  deedUTXO: string;
  imageHash: string;
  createdAt: number;
  lastUpdated: number;
  owner: string;
  uri?: string;
  wasPlacedBeforeBricking?: boolean;
}

export interface StateData {
  blockHash: string;
  parentHash: string;
  blockHeight: number;
  plots: PlotState[];
  deedUTXOs: string[];
  transactionCount: number;
}

export interface UBBConfig {
  environment: 'mainnet' | 'testnet' | 'regtest';
  genesisHash: string;
  tipHash: string;
  dataPath: string;
}

// Extend Window interface for UBB_CONFIG
declare global {
  interface Window {
    UBB_CONFIG: UBBConfig;
  }
}
