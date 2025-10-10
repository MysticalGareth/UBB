/**
 * Bitcoin Components
 * 
 * Exports:
 * - Bitcoin transaction parsing (bitcoin-transaction.ts)
 * - Bitcoin wallet and transaction building components (RPC client, wallet manager, transaction builder)
 */

// Bitcoin transaction parsing
export { BitcoinTransaction, BitcoinInput, BitcoinOutput } from './bitcoin-transaction';

// Bitcoin wallet and RPC components (generic for all networks)
export { BitcoinRpcClient, UTXO, BlockchainInfo, SignedTransaction } from './bitcoin-rpc-client';
export { WalletManager, WalletConfig } from './wallet-manager';
export { TransactionBuilder, ClaimTransactionResult, TransactionInput } from './transaction-builder';
