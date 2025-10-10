/**
 * Tests for recipient address functionality in transaction building
 * 
 * These tests verify that:
 * 1. Default behavior generates new addresses from wallet
 * 2. Custom recipient addresses are properly used when provided
 * 3. Transaction outputs contain correct addresses and amounts
 */

import { RegtestOrchestrator } from '../src/bitcoin/regtest';
import * as fs from 'fs';
import * as path from 'path';

describe('Recipient Address Tests', () => {
  let orchestrator: RegtestOrchestrator;
  const RPC_URL = process.env.BITCOIN_RPC_URL || 'http://user:password@127.0.0.1:18443';
  
  beforeAll(async () => {
    orchestrator = new RegtestOrchestrator({
      rpcUrl: RPC_URL,
      walletName: 'recipient_address_test',
      createWalletIfNotExists: true,
      fundWallet: true,
      autoMine: false,
      feeRate: 1
    });

    await orchestrator.setup();
  }, 60000);

  afterAll(async () => {
    await orchestrator.cleanup();
  });

  describe('buildClaimTransaction', () => {
    it('should generate new address when no recipient address provided (default behavior)', async () => {
      const x = 1000;
      const y = 2000;
      const uri = 'https://example.com/default';
      const bmpPath = path.join(__dirname, 'fixtures', 'bitcoin_uncompressed_24.bmp');
      const bmpHex = fs.readFileSync(bmpPath).toString('hex');

      const result = await orchestrator.createClaimTx(x, y, uri, bmpHex, false);

      expect(result.txid).toBeTruthy();
      expect(result.deedUTXO).toBeTruthy();
      expect(result.deedAddress).toBeTruthy();
      expect(result.hex).toBeTruthy();

      // Verify the address is a valid regtest address
      expect(result.deedAddress).toMatch(/^(bcrt1|[mn2])[a-zA-Z0-9]+$/);

      // Decode transaction and verify deed output
      const rpcClient = orchestrator.getRpcClient();
      const decoded = await rpcClient.decodeRawTransaction(result.hex);
      
      // Find the deed output (600 sats = 0.000006 BTC)
      const deedOutput = decoded.vout.find((out: any) => out.value === 0.000006);
      expect(deedOutput).toBeTruthy();
      expect(deedOutput.scriptPubKey.address).toBe(result.deedAddress);
    });

    it('should use custom recipient address when provided', async () => {
      const x = 1001;
      const y = 2001;
      const uri = 'https://example.com/custom';
      const bmpPath = path.join(__dirname, 'fixtures', 'bitcoin_uncompressed_24.bmp');
      const bmpHex = fs.readFileSync(bmpPath).toString('hex');

      // Generate a custom address for testing
      const rpcClient = orchestrator.getRpcClient();
      const customAddress = await rpcClient.getNewAddress();

      const result = await orchestrator.createClaimTx(x, y, uri, bmpHex, false, customAddress);

      expect(result.txid).toBeTruthy();
      expect(result.deedUTXO).toBeTruthy();
      expect(result.deedAddress).toBe(customAddress);
      expect(result.hex).toBeTruthy();

      // Decode transaction and verify deed output uses custom address
      const decoded = await rpcClient.decodeRawTransaction(result.hex);
      
      // Find the deed output (600 sats = 0.000006 BTC)
      const deedOutput = decoded.vout.find((out: any) => out.value === 0.000006);
      expect(deedOutput).toBeTruthy();
      expect(deedOutput.scriptPubKey.address).toBe(customAddress);
    });
  });

  describe('buildRetryClaimTransaction', () => {
    let initialDeedUTXO: string;
    let initialDeedAddress: string;

    beforeAll(async () => {
      // Create an initial claim to use as input for retry-claim tests
      const x = 1100;
      const y = 2100;
      const uri = 'https://example.com/initial';
      const bmpPath = path.join(__dirname, 'fixtures', 'bitcoin_uncompressed_24.bmp');
      const bmpHex = fs.readFileSync(bmpPath).toString('hex');

      const result = await orchestrator.createClaimTx(x, y, uri, bmpHex, true);
      initialDeedUTXO = result.deedUTXO;
      initialDeedAddress = result.deedAddress;

      // Mine a block to confirm the claim
      await orchestrator.mineBlock();
    }, 60000);

    it('should generate new address when no recipient address provided (default behavior)', async () => {
      const newX = 1200;
      const newY = 2200;

      const result = await orchestrator.createRetryClaimTx(newX, newY, initialDeedUTXO, false);

      expect(result.txid).toBeTruthy();
      expect(result.deedUTXO).toBeTruthy();
      expect(result.deedAddress).toBeTruthy();
      expect(result.hex).toBeTruthy();

      // The new deed address should be different from the initial one
      expect(result.deedAddress).not.toBe(initialDeedAddress);

      // Verify the address is valid
      expect(result.deedAddress).toMatch(/^(bcrt1|[mn2])[a-zA-Z0-9]+$/);

      // Decode transaction and verify deed output
      const rpcClient = orchestrator.getRpcClient();
      const decoded = await rpcClient.decodeRawTransaction(result.hex);
      
      const deedOutput = decoded.vout.find((out: any) => out.value === 0.000006);
      expect(deedOutput).toBeTruthy();
      expect(deedOutput.scriptPubKey.address).toBe(result.deedAddress);
    });

    it('should use custom recipient address when provided', async () => {
      const newX = 1201;
      const newY = 2201;

      // Generate a custom address for testing
      const rpcClient = orchestrator.getRpcClient();
      const customAddress = await rpcClient.getNewAddress();

      const result = await orchestrator.createRetryClaimTx(newX, newY, initialDeedUTXO, false, customAddress);

      expect(result.txid).toBeTruthy();
      expect(result.deedUTXO).toBeTruthy();
      expect(result.deedAddress).toBe(customAddress);
      expect(result.hex).toBeTruthy();

      // Decode transaction and verify deed output uses custom address
      const decoded = await rpcClient.decodeRawTransaction(result.hex);
      
      const deedOutput = decoded.vout.find((out: any) => out.value === 0.000006);
      expect(deedOutput).toBeTruthy();
      expect(deedOutput.scriptPubKey.address).toBe(customAddress);
    });
  });

  describe('buildUpdateTransaction', () => {
    let updateDeedUTXO: string;
    let updateDeedAddress: string;
    const updateX = 1300;
    const updateY = 2300;

    beforeAll(async () => {
      // Create an initial claim to use as input for update tests
      const uri = 'https://example.com/update-initial';
      const bmpPath = path.join(__dirname, 'fixtures', 'bitcoin_uncompressed_24.bmp');
      const bmpHex = fs.readFileSync(bmpPath).toString('hex');

      const result = await orchestrator.createClaimTx(updateX, updateY, uri, bmpHex, true);
      updateDeedUTXO = result.deedUTXO;
      updateDeedAddress = result.deedAddress;

      // Mine a block to confirm the claim
      await orchestrator.mineBlock();
    }, 60000);

    it('should generate new address when no recipient address provided (default behavior)', async () => {
      const newUri = 'https://example.com/updated-default';
      const bmpPath = path.join(__dirname, 'fixtures', 'bitcoin_uncompressed_24.bmp');
      const bmpHex = fs.readFileSync(bmpPath).toString('hex');

      const result = await orchestrator.createUpdateTx(updateX, updateY, newUri, bmpHex, updateDeedUTXO, false);

      expect(result.txid).toBeTruthy();
      expect(result.deedUTXO).toBeTruthy();
      expect(result.deedAddress).toBeTruthy();
      expect(result.hex).toBeTruthy();

      // The new deed address should be different from the initial one
      expect(result.deedAddress).not.toBe(updateDeedAddress);

      // Verify the address is valid
      expect(result.deedAddress).toMatch(/^(bcrt1|[mn2])[a-zA-Z0-9]+$/);

      // Decode transaction and verify deed output
      const rpcClient = orchestrator.getRpcClient();
      const decoded = await rpcClient.decodeRawTransaction(result.hex);
      
      const deedOutput = decoded.vout.find((out: any) => out.value === 0.000006);
      expect(deedOutput).toBeTruthy();
      expect(deedOutput.scriptPubKey.address).toBe(result.deedAddress);
    });

    it('should use custom recipient address when provided', async () => {
      const newUri = 'https://example.com/updated-custom';
      const bmpPath = path.join(__dirname, 'fixtures', 'bitcoin_uncompressed_24.bmp');
      const bmpHex = fs.readFileSync(bmpPath).toString('hex');

      // Generate a custom address for testing
      const rpcClient = orchestrator.getRpcClient();
      const customAddress = await rpcClient.getNewAddress();

      const result = await orchestrator.createUpdateTx(updateX, updateY, newUri, bmpHex, updateDeedUTXO, false, customAddress);

      expect(result.txid).toBeTruthy();
      expect(result.deedUTXO).toBeTruthy();
      expect(result.deedAddress).toBe(customAddress);
      expect(result.hex).toBeTruthy();

      // Decode transaction and verify deed output uses custom address
      const decoded = await rpcClient.decodeRawTransaction(result.hex);
      
      const deedOutput = decoded.vout.find((out: any) => out.value === 0.000006);
      expect(deedOutput).toBeTruthy();
      expect(deedOutput.scriptPubKey.address).toBe(customAddress);
    });
  });
});

