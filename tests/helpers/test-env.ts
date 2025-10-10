/**
 * Test environment configuration
 * Hardcoded to use local regtest node with credentials from tmp/bitcoin/bitcoin.conf
 */

// RPC URL matches tmp/bitcoin/bitcoin.conf (user:password)
const REGTEST_RPC_URL = 'http://user:password@127.0.0.1:18443';

export function getBitcoinRpcUrl(): string {
  return REGTEST_RPC_URL;
}

export function getTestConfig() {
  return {
    rpcUrl: REGTEST_RPC_URL,
    network: 'regtest' as const,
    // Number of blocks to mine for coinbase maturity
    maturityBlocks: 101,
    // Default fee rate for testing
    feeRate: 1,
  };
}
