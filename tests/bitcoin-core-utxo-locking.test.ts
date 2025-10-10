/**
 * Bitcoin Core UTXO Locking Behavior Tests
 * 
 * Tests to verify Core's behavior with locked UTXOs and fundrawtransaction.
 * These tests answer critical questions:
 * 1. Does fundrawtransaction respect locked UTXOs?
 * 2. Does fundrawtransaction calculate proper vBytes?
 * 3. Can we force specific UTXOs while still getting automatic fee calculation?
 */

import { RegtestOrchestrator } from '../src/bitcoin/regtest';
import { getBitcoinRpcUrl } from './helpers/test-env';

describe('Bitcoin Core UTXO Locking and Fee Calculation', () => {
  let orchestrator: RegtestOrchestrator;
  let rpcClient: any;
  let walletName: string;

  beforeAll(async () => {
    // Setup orchestrator with regtest
    orchestrator = new RegtestOrchestrator({
      rpcUrl: getBitcoinRpcUrl(),
      autoMine: false,
    });

    try {
      await orchestrator.setup();
      rpcClient = orchestrator.getRpcClient();
      walletName = orchestrator['walletName']; // Access private field for testing
    } catch (error) {
      console.log('⚠️  Regtest not available, skipping tests');
    }
  });

  describe('UTXO Locking Basic Behavior', () => {
    test('should lock and unlock UTXOs', async () => {
      if (!rpcClient) return;

      // Get a UTXO to test with
      const utxos = await rpcClient.listUnspent(1);
      expect(utxos.length).toBeGreaterThan(0);
      
      const testUTXO = utxos[0];
      
      // Lock the UTXO
      const lockResult = await rpcClient.call('lockunspent', [
        false,
        [{ txid: testUTXO.txid, vout: testUTXO.vout }]
      ]);
      expect(lockResult).toBe(true);
      
      // Verify it's locked
      const lockedUTXOs = await rpcClient.call('listlockunspent', []);
      expect(lockedUTXOs).toContainEqual({
        txid: testUTXO.txid,
        vout: testUTXO.vout
      });
      
      // Unlock it
      const unlockResult = await rpcClient.call('lockunspent', [
        true,
        [{ txid: testUTXO.txid, vout: testUTXO.vout }]
      ]);
      expect(unlockResult).toBe(true);
      
      // Verify it's unlocked
      const stillLocked = await rpcClient.call('listlockunspent', []);
      expect(stillLocked).not.toContainEqual({
        txid: testUTXO.txid,
        vout: testUTXO.vout
      });
    });

    test('should list all locked UTXOs', async () => {
      if (!rpcClient) return;

      const utxos = await rpcClient.listUnspent(1);
      expect(utxos.length).toBeGreaterThan(1);
      
      // Lock multiple UTXOs
      const toLock = utxos.slice(0, 2).map((u: any) => ({
        txid: u.txid,
        vout: u.vout
      }));
      
      await rpcClient.call('lockunspent', [false, toLock]);
      
      const locked = await rpcClient.call('listlockunspent', []);
      expect(locked.length).toBeGreaterThanOrEqual(2);
      
      // Cleanup
      await rpcClient.call('lockunspent', [true, toLock]);
    });
  });

  describe('fundrawtransaction with Locked UTXOs', () => {
    test('CRITICAL: fundrawtransaction should NOT use locked UTXOs', async () => {
      if (!rpcClient) return;

      const utxos = await rpcClient.listUnspent(1);
      expect(utxos.length).toBeGreaterThan(1);
      
      // Lock all but one UTXO
      const availableUTXO = utxos[0];
      const lockedUTXOs = utxos.slice(1, 3).map((u: any) => ({
        txid: u.txid,
        vout: u.vout
      }));
      
      await rpcClient.call('lockunspent', [false, lockedUTXOs]);
      
      try {
        // Create a transaction that needs funding
        const destAddress = await rpcClient.getNewAddress();
        const rawTx = await rpcClient.createRawTransaction(
          [],
          [{ [destAddress]: 0.001 }]
        );
        
        // Fund it - should only use unlocked UTXOs
        const funded = await rpcClient.call('fundrawtransaction', [rawTx, {
          add_inputs: true,
          includeWatching: false
        }]);
        
        // Decode to see which UTXOs were used
        const decoded = await rpcClient.call('decoderawtransaction', [funded.hex]);
        
        // Verify it didn't use any locked UTXOs
        for (const input of decoded.vin) {
          const wasLocked = lockedUTXOs.some(
            (locked: any) => locked.txid === input.txid && locked.vout === input.vout
          );
          expect(wasLocked).toBe(false);
        }
        
        console.log('✅ fundrawtransaction RESPECTS locked UTXOs');
      } finally {
        // Cleanup
        await rpcClient.call('lockunspent', [true, lockedUTXOs]);
      }
    });

    test('fundrawtransaction should fail if all UTXOs are locked and add_inputs=true', async () => {
      if (!rpcClient) return;

      const utxos = await rpcClient.listUnspent(1);
      
      // Lock ALL UTXOs
      const allUTXOs = utxos.map((u: any) => ({
        txid: u.txid,
        vout: u.vout
      }));
      
      await rpcClient.call('lockunspent', [false, allUTXOs]);
      
      try {
        const destAddress = await rpcClient.getNewAddress();
        const rawTx = await rpcClient.createRawTransaction(
          [],
          [{ [destAddress]: 0.001 }]
        );
        
        // This should fail - no unlocked UTXOs available
        await expect(
          rpcClient.call('fundrawtransaction', [rawTx, { add_inputs: true }])
        ).rejects.toThrow();
        
        console.log('✅ fundrawtransaction fails when all UTXOs locked');
      } finally {
        // Cleanup
        await rpcClient.call('lockunspent', [true, allUTXOs]);
      }
    });

    test('fundrawtransaction with add_inputs=false should use specified locked UTXO', async () => {
      if (!rpcClient) return;

      const utxos = await rpcClient.listUnspent(1);
      // Find a UTXO with enough funds (skip deed UTXOs which are 600 sats)
      const testUTXO = utxos.find((u: any) => u.amount > 0.001) || utxos[0];
      expect(testUTXO.amount).toBeGreaterThan(0.0001);
      
      // Lock the UTXO
      await rpcClient.call('lockunspent', [
        false,
        [{ txid: testUTXO.txid, vout: testUTXO.vout }]
      ]);
      
      try {
        // Create transaction explicitly using the locked UTXO
        const destAddress = await rpcClient.getNewAddress();
        const rawTx = await rpcClient.createRawTransaction(
          [{ txid: testUTXO.txid, vout: testUTXO.vout }],
          [{ [destAddress]: 0.0001 }]
        );
        
        // Fund it with add_inputs=false
        const funded = await rpcClient.call('fundrawtransaction', [rawTx, {
          add_inputs: false  // Don't add more inputs, just calculate fee and change
        }]);
        
        // Should succeed - we explicitly specified the input
        expect(funded.hex).toBeDefined();
        expect(funded.fee).toBeGreaterThan(0);
        
        // Verify it used our locked UTXO
        const decoded = await rpcClient.call('decoderawtransaction', [funded.hex]);
        expect(decoded.vin).toHaveLength(1);
        expect(decoded.vin[0].txid).toBe(testUTXO.txid);
        
        console.log('✅ fundrawtransaction with add_inputs=false CAN use locked UTXO if explicitly specified');
      } finally {
        // Cleanup
        await rpcClient.call('lockunspent', [
          true,
          [{ txid: testUTXO.txid, vout: testUTXO.vout }]
        ]);
      }
    });
  });

  describe('Fee Calculation: vBytes vs Bytes', () => {
    test('should calculate proper vBytes for SegWit transaction', async () => {
      if (!rpcClient) return;

      // Create a simple SegWit transaction
      const utxos = await rpcClient.listUnspent(1);
      // Find a UTXO with enough funds (skip deed UTXOs)
      const inputUTXO = utxos.find((u: any) => u.amount > 0.001) || utxos[0];
      expect(inputUTXO.amount).toBeGreaterThan(0.001);
      
      const destAddress = await rpcClient.getNewAddress();
      // Leave room for fee - use half the input amount
      const outputAmount = parseFloat((inputUTXO.amount * 0.5).toFixed(8));
      const rawTx = await rpcClient.createRawTransaction(
        [{ txid: inputUTXO.txid, vout: inputUTXO.vout }],
        [{ [destAddress]: outputAmount }]
      );
      
      const signed = await rpcClient.signRawTransactionWithWallet(rawTx);
      const decoded = await rpcClient.call('decoderawtransaction', [signed.hex]);
      
      // Calculate raw bytes
      const rawBytes = signed.hex.length / 2;
      
      // Get vsize (virtual size) from Core
      const vBytes = decoded.vsize;
      
      // For SegWit, vBytes should be less than raw bytes
      expect(vBytes).toBeLessThanOrEqual(rawBytes);
      
      console.log(`Raw bytes: ${rawBytes}, vBytes: ${vBytes}, Discount: ${((1 - vBytes/rawBytes) * 100).toFixed(1)}%`);
      
      // Test fee calculation difference
      const feeRate = 2; // sats/vByte
      const feeFromVBytes = vBytes * feeRate;
      const feeFromBytes = rawBytes * feeRate;
      const overPayment = feeFromBytes - feeFromVBytes;
      
      console.log(`Fee from vBytes: ${feeFromVBytes} sats`);
      console.log(`Fee from raw bytes: ${feeFromBytes} sats`);
      console.log(`Overpayment if using bytes: ${overPayment} sats (${((overPayment/feeFromVBytes) * 100).toFixed(1)}%)`);
      
      expect(overPayment).toBeGreaterThan(0);
    });
  });

  describe('Combining Manual Input Selection with Auto Fee Calculation', () => {
    test('should use specific input UTXO and let Core calculate fee/change', async () => {
      if (!rpcClient) return;

      const utxos = await rpcClient.listUnspent(1);
      // Need a UTXO large enough for deed + fee + change
      const selectedUTXO = utxos.find((u: any) => u.amount > 0.0001) || utxos[0];
      expect(selectedUTXO.amount).toBeGreaterThan(0.00001);
      
      // Create transaction with our selected input
      const destAddress = await rpcClient.getNewAddress();
      const deedAddress = await rpcClient.getNewAddress();
      
      const rawTx = await rpcClient.createRawTransaction(
        [{ txid: selectedUTXO.txid, vout: selectedUTXO.vout }],
        [
          { data: 'deadbeef' }, // OP_RETURN
          { [deedAddress]: 0.000006 } // 600 sat deed
        ]
      );
      
      // Let Core add change and calculate fee
      const changeAddress = await rpcClient.getNewAddress();
      const funded = await rpcClient.call('fundrawtransaction', [rawTx, {
        add_inputs: false,  // Use only our selected input
        changeAddress: changeAddress,
        feeRate: 0.00001  // 1 sat/vByte
      }]);
      
      const decoded = await rpcClient.call('decoderawtransaction', [funded.hex]);
      
      // Verify structure
      expect(decoded.vin).toHaveLength(1);
      expect(decoded.vin[0].txid).toBe(selectedUTXO.txid);
      expect(decoded.vout.length).toBeGreaterThanOrEqual(2); // OP_RETURN + deed + maybe change
      
      // Check outputs
      let hasOpReturn = false;
      let hasDeed = false;
      let hasChange = false;
      
      for (const output of decoded.vout) {
        if (output.scriptPubKey?.type === 'nulldata') hasOpReturn = true;
        if (output.value === 0.000006) hasDeed = true;
        if (output.value > 0.000006) hasChange = true;
      }
      
      expect(hasOpReturn).toBe(true);
      expect(hasDeed).toBe(true);
      
      console.log('✅ Can combine manual input selection with automatic fee/change calculation');
      console.log(`   Inputs: ${decoded.vin.length}, Outputs: ${decoded.vout.length}, Fee: ${funded.fee} BTC`);
    });

    test('should handle case where change is too small (dust)', async () => {
      if (!rpcClient) return;

      // Get a medium-sized UTXO (not too large, not too small)
      const utxos = await rpcClient.listUnspent(1);
      const mediumUTXO = utxos.find((u: any) => u.amount > 0.0001 && u.amount < 0.01) 
        || utxos.find((u: any) => u.amount > 0.0001) 
        || utxos[0];
      expect(mediumUTXO.amount).toBeGreaterThan(0.0001);
      
      const destAddress = await rpcClient.getNewAddress();
      
      // Create transaction that would leave dust as change
      // Leave only ~200 sats for fee+change (but ensure positive amount)
      const outputAmount = parseFloat((mediumUTXO.amount - 0.000002).toFixed(8));
      expect(outputAmount).toBeGreaterThan(0); // Ensure valid amount
      const rawTx = await rpcClient.createRawTransaction(
        [{ txid: mediumUTXO.txid, vout: mediumUTXO.vout }],
        [{ [destAddress]: outputAmount }]
      );
      
      const funded = await rpcClient.call('fundrawtransaction', [rawTx, {
        add_inputs: false
      }]);
      
      const decoded = await rpcClient.call('decoderawtransaction', [funded.hex]);
      
      console.log(`Change handling: ${decoded.vout.length} outputs`);
      console.log(`Fee: ${funded.fee} BTC`);
      
      // If change is dust, Core either adds it to fee or adds another input
      // This documents the behavior
      expect(decoded.vout.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Safety: Preventing Deed UTXO Spending', () => {
    test('Invariant: all deed (600-sat) UTXOs are locked after each transaction we build', async () => {
      if (!rpcClient) return;

      // Create minimal valid 1x1 24-bit BMP
      function createMinimalBMP(): Buffer {
        const headerSize = 54;
        const stride = 4; // 1 pixel * 3 bytes, padded to 4
        const fileSize = headerSize + stride;
        const buffer = Buffer.alloc(fileSize);
        buffer.write('BM', 0);
        buffer.writeUInt32LE(fileSize, 2);
        buffer.writeUInt32LE(0, 6);
        buffer.writeUInt32LE(headerSize, 10);
        buffer.writeUInt32LE(40, 14);
        buffer.writeInt32LE(1, 18); // width
        buffer.writeInt32LE(1, 22); // height
        buffer.writeUInt16LE(1, 26);
        buffer.writeUInt16LE(24, 28); // 24-bit
        buffer.writeUInt32LE(0, 30);
        buffer.writeUInt32LE(stride, 34);
        return buffer;
      }
      
      const bmpHex = createMinimalBMP().toString('hex');
      
      // Use existing orchestrator
      const claim1 = await orchestrator.createClaimTx(10, 10, '', bmpHex);
      await orchestrator.mineBlock();
      const claim2 = await orchestrator.createClaimTx(20, 20, '', bmpHex);
      await orchestrator.mineBlock();

      // Query all locked UTXOs and all unspents to verify all 600-sat outputs are locked
      const utxos = await rpcClient.listUnspent(0);
      const locked = await rpcClient.listLockUnspent();

      const deedUTXOs = utxos.filter((u: any) => Math.abs(u.amount - 0.000006) < 0.00000001);
      for (const u of deedUTXOs) {
        const isLocked = locked.some((l: any) => l.txid === u.txid && l.vout === u.vout);
        expect(isLocked).toBe(true);
      }
    });
    test('locking all deed UTXOs should prevent accidental spending', async () => {
      if (!rpcClient) return;

      // Create a "deed" UTXO (600 sats)
      const deedAddress = await rpcClient.getNewAddress();
      const utxos = await rpcClient.listUnspent(1);
      // Find a large UTXO to fund the deed creation
      const fundingUTXO = utxos.find((u: any) => u.amount > 0.0001) || utxos[0];
      expect(fundingUTXO.amount).toBeGreaterThan(0.00001);
      
      // Create transaction with 600 sat output (simulating a deed)
      // Reserve enough for deed (600 sats) + fee (~200 sats)
      const changeAmount = parseFloat((fundingUTXO.amount - 0.000006 - 0.000002).toFixed(8));
      expect(changeAmount).toBeGreaterThan(0); // Sanity check
      
      const rawTx = await rpcClient.createRawTransaction(
        [{ txid: fundingUTXO.txid, vout: fundingUTXO.vout }],
        [
          { [deedAddress]: 0.000006 },
          { [await rpcClient.getNewAddress()]: changeAmount }
        ]
      );
      
      const signed = await rpcClient.signRawTransactionWithWallet(rawTx);
      const deedTxid = await rpcClient.sendRawTransaction(signed.hex);
      
      // Mine a block so UTXO is spendable
      await orchestrator.mineBlock();
      
      // Lock the deed UTXO
      await rpcClient.call('lockunspent', [false, [{ txid: deedTxid, vout: 0 }]]);
      
      try {
        // Try to create a transaction that Core would auto-select UTXOs for
        const destAddress = await rpcClient.getNewAddress();
        const tx = await rpcClient.createRawTransaction([], [{ [destAddress]: 0.0001 }]);
        
        const funded = await rpcClient.call('fundrawtransaction', [tx]);
        const decoded = await rpcClient.call('decoderawtransaction', [funded.hex]);
        
        // Verify the deed UTXO was NOT selected
        const usedDeed = decoded.vin.some((input: any) => 
          input.txid === deedTxid && input.vout === 0
        );
        
        expect(usedDeed).toBe(false);
        
        console.log('✅ Locked deed UTXO was not selected by fundrawtransaction');
      } finally {
        // Cleanup
        await rpcClient.call('lockunspent', [true, [{ txid: deedTxid, vout: 0 }]]);
      }
    });
  });
});
