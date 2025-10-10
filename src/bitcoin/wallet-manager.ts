/**
 * Wallet Manager for regtest testing
 * 
 * Handles wallet creation, funding, and UTXO management
 */

import { BitcoinRpcClient, UTXO } from './bitcoin-rpc-client';

export interface WalletConfig {
  walletName?: string;
  walletPassphrase?: string;
  createIfNotExists?: boolean;
  fundWallet?: boolean;
}

export class WalletManager {
  private readonly rpcClient: BitcoinRpcClient;
  private walletName: string | null = null;
  private fundingAddress: string | null = null;
  private isNewWallet: boolean = false;
  private walletPassphrase: string | null = null;

  // Fixed wallet name for persistent test wallet across runs (regtest only)
  private static readonly DEFAULT_WALLET_NAME = 'ubb_test_wallet';

  constructor(rpcClient: BitcoinRpcClient, private config: WalletConfig = {}) {
    this.rpcClient = rpcClient;
    this.walletPassphrase = config.walletPassphrase || null;
  }

  /**
   * Setup a wallet for UBB transactions
   * For regtest: Uses a fixed name for persistence across runs
   * For mainnet/testnet: Uses provided wallet name or throws error if not specified
   */
  async setupWallet(): Promise<string> {
    // Determine wallet name
    const walletName = this.config.walletName || WalletManager.DEFAULT_WALLET_NAME;
    this.walletName = walletName;

    // For mainnet/testnet, wallet name must be explicitly provided
    if (!this.config.walletName && !this.config.createIfNotExists) {
      throw new Error('Wallet name must be specified for non-regtest usage');
    }

    // Try to create wallet if configured (regtest mode)
    if (this.config.createIfNotExists) {
      try {
        await this.rpcClient.createWallet(this.walletName);
        this.isNewWallet = true;
        console.log(`Created new wallet: ${this.walletName}`);
      } catch (error) {
        // Wallet already exists - try to load it
        if (error instanceof Error && error.message.includes('already exists')) {
          try {
            await this.rpcClient.loadWallet(this.walletName);
            this.isNewWallet = false;
            console.log(`Loaded existing wallet: ${this.walletName}`);
          } catch (loadError) {
            // Wallet already loaded - that's fine, just use it
            if (loadError instanceof Error && loadError.message.includes('already loaded')) {
              this.isNewWallet = false;
              console.log(`Using already-loaded wallet: ${this.walletName}`);
            } else {
              throw loadError;
            }
          }
        } else {
          throw error;
        }
      }
    } else {
      // Production mode - wallet must already exist, just load it
      try {
        await this.rpcClient.loadWallet(this.walletName);
        this.isNewWallet = false;
        console.log(`Loaded existing wallet: ${this.walletName}`);
      } catch (error) {
        // Wallet already loaded - that's fine, just use it
        if (error instanceof Error && error.message.includes('already loaded')) {
          this.isNewWallet = false;
          console.log(`Using already-loaded wallet: ${this.walletName}`);
        } else {
          throw new Error(`Failed to load wallet '${this.walletName}': ${error instanceof Error ? error.message : 'unknown'}`);
        }
      }
    }

    // IMPORTANT: Always set the wallet on the RPC client, even if already loaded
    // This is required when multiple wallets exist in the node
    this.rpcClient.setWallet(this.walletName);

    // Unlock wallet if passphrase is provided
    if (this.walletPassphrase) {
      try {
        await this.rpcClient.walletPassphrase(this.walletPassphrase, 600); // 10 minutes
        console.log('Wallet unlocked successfully');
      } catch (error) {
        throw new Error(`Failed to unlock wallet: ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }

    return this.walletName;
  }

  /**
   * Fund the wallet by mining blocks to get matured coinbase rewards (regtest only)
   * For mainnet/testnet: Just checks available UTXOs
   */
  async fundWallet(): Promise<void> {
    if (!this.walletName) {
      throw new Error('Wallet not setup. Call setupWallet() first.');
    }

    const utxos = await this.rpcClient.listUnspent(1);

    // Mainnet/testnet mode: just check and report UTXOs, never mine
    if (this.config.fundWallet === false) {
      console.log(`Wallet has ${utxos.length} spendable UTXO(s)`);
      if (utxos.length === 0) {
        console.warn('Warning: Wallet has no spendable UTXOs. You may need to fund it manually.');
      }
      return;
    }

    // Regtest mode: mine blocks if needed
    // CRITICAL: generateToAddress only works in regtest, will fail on mainnet/testnet
    if (!this.fundingAddress) {
      this.fundingAddress = await this.rpcClient.getNewAddress();
    }

    if (this.isNewWallet) {
      // New wallet - mine initial blocks to reach coinbase maturity (regtest only)
      console.log(`Mining 101 blocks to address: ${this.fundingAddress} (initial wallet funding)`);
      await this.rpcClient.generateToAddress(101, this.fundingAddress);
      
      const updatedUtxos = await this.rpcClient.listUnspent(1);
      console.log(`New wallet funded with ${updatedUtxos.length} spendable UTXO(s)`);
    } else {
      // Existing wallet - check available UTXOs
      console.log(`Existing wallet has ${utxos.length} spendable UTXO(s) - self-replenishing as tests run`);
      
      if (utxos.length === 0) {
        // Edge case: wallet exists but has no UTXOs (regtest only)
        console.log('Warning: Existing wallet has no UTXOs, mining additional blocks...');
        await this.rpcClient.generateToAddress(101, this.fundingAddress);
      }
    }
  }

  /**
   * Get a spendable UTXO with at least the specified amount
   * Defends against unpredictable block rewards by finding any UTXO that meets the requirement
   * Automatically excludes deed UTXOs (600 sats) to prevent accidentally spending plot deeds
   */
  async getSpendableUTXO(minAmount: number, excludeUTXOs?: Array<{txid: string; vout: number}>): Promise<UTXO> {
    const utxos = await this.rpcClient.listUnspent(1);

    if (utxos.length === 0) {
      throw new Error('No spendable UTXOs available. Fund the wallet first.');
    }

    // Convert minAmount from satoshis to BTC
    const minAmountBTC = minAmount / 100000000;
    
    // Deed UTXO amount (600 sats = 0.000006 BTC)
    const DEED_AMOUNT_BTC = 0.000006;

    // Filter out excluded UTXOs and deed UTXOs
    let availableUTXOs = utxos;
    if (excludeUTXOs && excludeUTXOs.length > 0) {
      availableUTXOs = utxos.filter(utxo => {
        return !excludeUTXOs.some(excluded => 
          excluded.txid === utxo.txid && excluded.vout === utxo.vout
        );
      });
    }
    
    // Also filter out deed UTXOs (exactly 600 sats) to prevent accidentally spending plot deeds
    availableUTXOs = availableUTXOs.filter(utxo => utxo.amount !== DEED_AMOUNT_BTC);

    // Find a UTXO with sufficient funds
    const suitableUTXO = availableUTXOs.find(utxo => utxo.amount >= minAmountBTC && utxo.spendable);

    if (!suitableUTXO) {
      const totalAvailable = availableUTXOs.reduce((sum, utxo) => sum + utxo.amount, 0);
      const spendableCount = availableUTXOs.filter(u => u.spendable).length;
      const lockedCount = availableUTXOs.filter(u => !u.spendable).length;
      throw new Error(
        `No UTXO found with at least ${minAmountBTC} BTC (${minAmount} sats). ` +
        `Total available: ${totalAvailable} BTC across ${availableUTXOs.length} UTXOs ` +
        `(${spendableCount} spendable, ${lockedCount} locked)`
      );
    }

    return suitableUTXO;
  }

  /**
   * Create multiple new addresses for testing
   */
  async createAddresses(count: number): Promise<string[]> {
    if (!this.walletName) {
      throw new Error('Wallet not setup. Call setupWallet() first.');
    }

    const addresses: string[] = [];
    for (let i = 0; i < count; i++) {
      const address = await this.rpcClient.getNewAddress();
      addresses.push(address);
    }

    return addresses;
  }

  /**
   * Get all spendable UTXOs
   */
  async getAllSpendableUTXOs(): Promise<UTXO[]> {
    return this.rpcClient.listUnspent(1);
  }

  /**
   * Get wallet name
   */
  getWalletName(): string | null {
    return this.walletName;
  }

  /**
   * Get funding address
   */
  getFundingAddress(): string | null {
    return this.fundingAddress;
  }

  /**
   * Lock all deed UTXOs (600 sats) except the specified one
   * This prevents them from being accidentally selected as funding inputs
   * 
   * @param exceptDeed - Optional deed to exclude from locking (the one being spent)
   */
  async lockAllDeedUTXOsExcept(exceptDeed?: { txid: string; vout: number }): Promise<number> {
    const DEED_AMOUNT = 0.000006; // 600 sats
    const allUTXOs = await this.rpcClient.listUnspent(1);
    
    const deedUTXOs = allUTXOs.filter(utxo => {
      // Find all 600-sat UTXOs
      if (Math.abs(utxo.amount - DEED_AMOUNT) < 0.00000001) {
        // Exclude the specific deed we're spending
        if (exceptDeed && utxo.txid === exceptDeed.txid && utxo.vout === exceptDeed.vout) {
          return false;
        }
        return true;
      }
      return false;
    });

    if (deedUTXOs.length > 0) {
      const toLock = deedUTXOs.map(utxo => ({ txid: utxo.txid, vout: utxo.vout }));
      
      // Check which ones are already locked to avoid conflicts
      const alreadyLocked = await this.rpcClient.listLockUnspent();
      const newToLock = toLock.filter(utxo => 
        !alreadyLocked.some(locked => locked.txid === utxo.txid && locked.vout === utxo.vout)
      );
      
      if (newToLock.length > 0) {
        const lockResult = await this.rpcClient.lockUnspent(false, newToLock);
        
        if (!lockResult) {
          throw new Error(`Failed to lock ${newToLock.length} deed UTXOs - lockUnspent returned false. UTXOs: ${newToLock.map(u => u.txid.substring(0,8) + ':' + u.vout).join(', ')}`);
        }
      }
    }

    return deedUTXOs.length;
  }
}
