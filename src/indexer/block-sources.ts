import axios from 'axios';

export interface BlockSource {
  // Returns hex string of raw block data for the given hash
  getBlockHex(blockHash: string): Promise<string>;
  
  // Returns the current chain tip block hash
  getTipHash(): Promise<string>;
  
  // Returns the block hash at a specific height
  getBlockHashAtHeight(height: number): Promise<string>;
  
  // Returns the block height for a given block hash
  getBlockHeight(blockHash: string): Promise<number>;
}

export class RpcBlockSource implements BlockSource {
  private readonly rpcUrl: string;
  private readonly expectedNetwork: 'mainnet' | 'testnet' | 'regtest';
  private networkVerified = false;

  constructor(rpcUrl: string, expectedNetwork: 'mainnet' | 'testnet' | 'regtest') {
    this.rpcUrl = rpcUrl;
    this.expectedNetwork = expectedNetwork;
  }

  private async ensureNetworkMatch(): Promise<void> {
    if (this.networkVerified) return;
    const payload = {
      jsonrpc: '1.0',
      id: 'ubb',
      method: 'getblockchaininfo',
      params: []
    };
    const response = await axios.post(this.rpcUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.data && response.data.error) {
      throw new Error(`RPC error (getblockchaininfo): ${response.data.error.message || 'unknown'}`);
    }
    const chain: string = response.data.result?.chain;
    if (!chain) {
      throw new Error('RPC getblockchaininfo returned no chain');
    }
    // Core returns: main, test, regtest, signet, testnet4
    const isMain = chain === 'main';
    const isTestFamily = chain === 'test' || chain === 'testnet4' || chain === 'regtest' || chain === 'signet';
    const ok = this.expectedNetwork === 'mainnet' ? isMain : isTestFamily;
    if (!ok) {
      throw new Error(`RPC network mismatch: node=${chain}, expected=${this.expectedNetwork}`);
    }
    this.networkVerified = true;
  }

  async getBlockHex(blockHash: string): Promise<string> {
    await this.ensureNetworkMatch();
    // Call getblock with verbosity=0 to receive raw hex
    const payload = {
      jsonrpc: '1.0',
      id: 'ubb',
      method: 'getblock',
      params: [blockHash, 0]
    };

    const response = await axios.post(this.rpcUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.error) {
      throw new Error(`RPC error: ${response.data.error.message || 'unknown'}`);
    }

    const hex: string = response.data.result;
    if (typeof hex !== 'string' || hex.length === 0) {
      throw new Error('RPC returned empty block hex');
    }
    return hex;
  }

  async getTipHash(): Promise<string> {
    await this.ensureNetworkMatch();
    // Call getbestblockhash to get the current chain tip
    const payload = {
      jsonrpc: '1.0',
      id: 'ubb',
      method: 'getbestblockhash',
      params: []
    };

    const response = await axios.post(this.rpcUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.error) {
      throw new Error(`RPC error (getbestblockhash): ${response.data.error.message || 'unknown'}`);
    }

    const hash: string = response.data.result;
    if (typeof hash !== 'string' || hash.length !== 64) {
      throw new Error('RPC returned invalid block hash');
    }
    return hash;
  }

  async getBlockHashAtHeight(height: number): Promise<string> {
    await this.ensureNetworkMatch();
    // Call getblockhash to get the block hash at a specific height
    const payload = {
      jsonrpc: '1.0',
      id: 'ubb',
      method: 'getblockhash',
      params: [height]
    };

    const response = await axios.post(this.rpcUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.error) {
      throw new Error(`RPC error (getblockhash): ${response.data.error.message || 'unknown'}`);
    }

    const hash: string = response.data.result;
    if (typeof hash !== 'string' || hash.length !== 64) {
      throw new Error('RPC returned invalid block hash');
    }
    return hash;
  }
  
  async getBlockHeight(blockHash: string): Promise<number> {
    await this.ensureNetworkMatch();
    // Call getblock with verbosity=1 to get block metadata including height
    const payload = {
      jsonrpc: '1.0',
      id: 'ubb',
      method: 'getblock',
      params: [blockHash, 1]
    };

    const response = await axios.post(this.rpcUrl, payload, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.data && response.data.error) {
      throw new Error(`RPC error (getblock): ${response.data.error.message || 'unknown'}`);
    }

    const height: number = response.data.result?.height;
    if (typeof height !== 'number') {
      throw new Error('RPC returned invalid block height');
    }
    return height;
  }
}


