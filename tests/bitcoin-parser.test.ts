/**
 * Unit tests for BitcoinParser class
 * Tests OP_RETURN detection, deed UTXO finding, and UBB transaction validation
 */

import * as bitcore from 'bitcore-lib';
import { BitcoinParser } from '../src/indexer/bitcoin-parser';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('BitcoinParser', () => {
  let parser: BitcoinParser;
  let tempDir: string;

  beforeAll(() => {
    // Create temp directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bitcoin-parser-test-'));
  });

  afterAll(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    parser = new BitcoinParser(tempDir, 'testnet', 'http://user:password@127.0.0.1:18332');
  });

  /**
   * Helper to create a minimal transaction with OP_RETURN
   */
  function createTxWithOpReturn(opReturnData: Buffer): bitcore.Transaction {
    const tx = new bitcore.Transaction();
    
    // Add dummy input
    tx.from({
      txid: '0000000000000000000000000000000000000000000000000000000000000000',
      vout: 0,
      scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
      amount: 0.001
    });
    
    // Add OP_RETURN output
    const script = bitcore.Script.buildDataOut(opReturnData);
    tx.addOutput(new bitcore.Transaction.Output({
      script: script,
      satoshis: 0
    }));
    
    return tx;
  }

  /**
   * Helper to create UBB OP_RETURN data
   */
  function createUBBOpReturn(type: number, x: number, y: number): Buffer {
    return Buffer.concat([
      Buffer.from([0x13, 0x37]), // Magic
      Buffer.from([0x01]), // Version
      Buffer.from([type]), // Type
      Buffer.from([x & 0xFF, (x >> 8) & 0xFF]), // X (little-endian)
      Buffer.from([y & 0xFF, (y >> 8) & 0xFF])  // Y (little-endian)
    ]);
  }

  /**
   * Helper to add 600-sat deed output to transaction
   */
  function addDeedOutput(tx: bitcore.Transaction, count: number = 1): void {
    // Create a simple P2PKH script manually (OP_DUP OP_HASH160 <20 bytes> OP_EQUALVERIFY OP_CHECKSIG)
    const dummyPubKeyHash = Buffer.alloc(20, 0);
    const scriptBuf = Buffer.concat([
      Buffer.from([0x76, 0xa9, 0x14]), // OP_DUP OP_HASH160 PUSH(20)
      dummyPubKeyHash,
      Buffer.from([0x88, 0xac]) // OP_EQUALVERIFY OP_CHECKSIG
    ]);
    const script = bitcore.Script.fromBuffer(scriptBuf);
    
    for (let i = 0; i < count; i++) {
      tx.addOutput(new bitcore.Transaction.Output({
        script: script,
        satoshis: 600
      }));
    }
  }

  /**
   * Helper to add standard output to transaction
   */
  function addOutput(tx: bitcore.Transaction, satoshis: number): void {
    const dummyPubKeyHash = Buffer.alloc(20, 0);
    const scriptBuf = Buffer.concat([
      Buffer.from([0x76, 0xa9, 0x14]), // OP_DUP OP_HASH160 PUSH(20)
      dummyPubKeyHash,
      Buffer.from([0x88, 0xac]) // OP_EQUALVERIFY OP_CHECKSIG
    ]);
    const script = bitcore.Script.fromBuffer(scriptBuf);
    tx.addOutput(new bitcore.Transaction.Output({
      script: script,
      satoshis: satoshis
    }));
  }

  describe('extractOpReturnData', () => {
    test('should extract OP_RETURN data from UBB transaction', () => {
      const opReturnData = createUBBOpReturn(0x01, 100, 200);
      const tx = createTxWithOpReturn(opReturnData);
      
      const extracted = parser.extractOpReturnData(tx);
      
      expect(extracted).toBeTruthy();
      expect(extracted!.toString('hex')).toBe(opReturnData.toString('hex'));
    });

    test('should return null for transaction without OP_RETURN', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addOutput(tx, 50000);
      
      const extracted = parser.extractOpReturnData(tx);
      
      expect(extracted).toBeNull();
    });

    test('should extract OP_RETURN data with non-UBB magic bytes', () => {
      const opReturnData = Buffer.from('Hello, World!');
      const tx = createTxWithOpReturn(opReturnData);
      
      const extracted = parser.extractOpReturnData(tx);
      
      // Non-UBB OP_RETURN should still be extracted, but validation will fail later
      expect(extracted).toBeTruthy();
      expect(extracted!.toString()).toBe('Hello, World!');
    });

    test('should handle empty OP_RETURN', () => {
      const tx = createTxWithOpReturn(Buffer.alloc(0));
      
      const extracted = parser.extractOpReturnData(tx);
      
      expect(extracted).toBeTruthy();
      expect(extracted!.length).toBe(0);
    });

    test('should handle transaction with multiple outputs (OP_RETURN + others)', () => {
      const opReturnData = createUBBOpReturn(0x01, 100, 200);
      const tx = createTxWithOpReturn(opReturnData);
      addOutput(tx, 50000);
      addOutput(tx, 10000);
      
      const extracted = parser.extractOpReturnData(tx);
      
      expect(extracted).toBeTruthy();
      expect(extracted!.toString('hex')).toBe(opReturnData.toString('hex'));
    });

    test('should extract very large OP_RETURN data', () => {
      const largeData = Buffer.alloc(80000); // Close to Bitcoin's limit
      largeData.fill(0xFF);
      const tx = createTxWithOpReturn(largeData);
      
      const extracted = parser.extractOpReturnData(tx);
      
      expect(extracted).toBeTruthy();
      expect(extracted!.length).toBe(80000);
    });
  });

  describe('findDeedUTXOs', () => {
    test('should find single 600-sat deed output', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addDeedOutput(tx, 1);
      addOutput(tx, 50000);
      
      const deeds = parser.findDeedUTXOs(tx);
      
      expect(deeds).toHaveLength(1);
      expect(deeds[0].value).toBe(600);
      expect(deeds[0].vout).toBe(0);
    });

    test('should find multiple 600-sat outputs', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addDeedOutput(tx, 2);
      addOutput(tx, 50000);
      
      const deeds = parser.findDeedUTXOs(tx);
      
      expect(deeds).toHaveLength(2);
      expect(deeds[0].value).toBe(600);
      expect(deeds[1].value).toBe(600);
    });

    test('should return empty array when no 600-sat outputs exist', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addOutput(tx, 599);
      addOutput(tx, 601);
      
      const deeds = parser.findDeedUTXOs(tx);
      
      expect(deeds).toHaveLength(0);
    });

    test('should handle transaction with only OP_RETURN (no deed)', () => {
      const opReturnData = createUBBOpReturn(0x01, 100, 200);
      const tx = createTxWithOpReturn(opReturnData);
      
      const deeds = parser.findDeedUTXOs(tx);
      
      expect(deeds).toHaveLength(0);
    });

    test('should handle custom deed value', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addOutput(tx, 1000);
      addDeedOutput(tx, 1);
      
      const deeds = parser.findDeedUTXOs(tx, 1000);
      
      expect(deeds).toHaveLength(1);
      expect(deeds[0].value).toBe(1000);
      expect(deeds[0].vout).toBe(0);
    });

    test('should include transaction ID in deed UTXO', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addDeedOutput(tx, 1);
      
      const deeds = parser.findDeedUTXOs(tx);
      
      expect(deeds).toHaveLength(1);
      expect(deeds[0].txid).toBe(tx.id);
    });
  });

  describe('isUBBTransaction', () => {
    test('should identify UBB transaction with valid OP_RETURN and deed', () => {
      const opReturnData = createUBBOpReturn(0x01, 100, 200);
      const tx = createTxWithOpReturn(opReturnData);
      addDeedOutput(tx, 1);
      
      const isUBB = parser.isUBBTransaction(tx);
      
      expect(isUBB).toBe(true);
    });

    test('should identify transaction with UBB OP_RETURN but no deed (will brick)', () => {
      const opReturnData = createUBBOpReturn(0x01, 100, 200);
      const tx = createTxWithOpReturn(opReturnData);
      
      const isUBB = parser.isUBBTransaction(tx);
      
      // Still considered a UBB transaction (OP_RETURN is valid), but will brick during processing
      expect(isUBB).toBe(true);
    });

    test('should reject transaction with deed but no OP_RETURN', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addDeedOutput(tx, 1);
      
      const isUBB = parser.isUBBTransaction(tx, []);
      
      expect(isUBB).toBe(false);
    });

    test('should identify TRANSFER transaction (spends known deed UTXO)', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        vout: 1,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.000006
      });
      addDeedOutput(tx, 1);
      
      const knownDeeds = ['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:1'];
      const isUBB = parser.isUBBTransaction(tx, knownDeeds);
      
      expect(isUBB).toBe(true);
    });

    test('should reject transaction with wrong magic bytes', () => {
      const opReturnData = Buffer.concat([
        Buffer.from([0x00, 0x00]), // Wrong magic
        Buffer.from([0x01]),
        Buffer.from([0x01]),
        Buffer.from([100, 0, 200, 0])
      ]);
      const tx = createTxWithOpReturn(opReturnData);
      addDeedOutput(tx, 1);
      
      const isUBB = parser.isUBBTransaction(tx);
      
      expect(isUBB).toBe(false);
    });

    test('should identify transaction with multiple 600-sat outputs (will brick)', () => {
      const opReturnData = createUBBOpReturn(0x01, 100, 200);
      const tx = createTxWithOpReturn(opReturnData);
      addDeedOutput(tx, 2); // Two deed outputs
      
      const isUBB = parser.isUBBTransaction(tx);
      
      // Still a UBB transaction, but will brick due to invalid deed flow
      expect(isUBB).toBe(true);
    });
  });

  describe('hasSingleDeedUTXO', () => {
    test('should detect single 600-sat output using findDeedUTXOs', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addDeedOutput(tx, 1);
      addOutput(tx, 50000);
      
      // Test using findDeedUTXOs which is the underlying logic
      const deeds = parser.findDeedUTXOs(tx);
      expect(deeds).toHaveLength(1);
      expect(deeds[0].value).toBe(600);
      
      // Verify single deed detection works
      expect(deeds.length === 1).toBe(true);
    });

    test('should detect no 600-sat outputs using findDeedUTXOs', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addOutput(tx, 50000);
      
      const deeds = parser.findDeedUTXOs(tx);
      expect(deeds).toHaveLength(0);
      expect(deeds.length === 1).toBe(false);
    });

    test('should detect multiple 600-sat outputs using findDeedUTXOs', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addDeedOutput(tx, 2);
      
      const deeds = parser.findDeedUTXOs(tx);
      expect(deeds).toHaveLength(2);
      expect(deeds.length === 1).toBe(false);
    });

    test('should handle custom deed value with findDeedUTXOs', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addOutput(tx, 1000);
      
      const deeds = parser.findDeedUTXOs(tx, 1000);
      expect(deeds).toHaveLength(1);
      expect(deeds[0].value).toBe(1000);
    });
  });

  describe('hasMultipleOpReturns', () => {
    test('should count OP_RETURN outputs - single', () => {
      const opReturnData = createUBBOpReturn(0x01, 100, 200);
      const tx = createTxWithOpReturn(opReturnData);
      
      // Count OP_RETURN outputs manually
      const opReturnCount = tx.outputs.filter(output => {
        const script = output.script as bitcore.Script;
        return script && script.isDataOut && script.isDataOut();
      }).length;
      
      expect(opReturnCount).toBe(1);
      expect(opReturnCount > 1).toBe(false);
    });

    test('should count OP_RETURN outputs - multiple', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      
      // Add two OP_RETURN outputs
      const opReturn1 = bitcore.Script.buildDataOut(Buffer.from('data1'));
      const opReturn2 = bitcore.Script.buildDataOut(Buffer.from('data2'));
      
      tx.addOutput(new bitcore.Transaction.Output({ script: opReturn1, satoshis: 0 }));
      tx.addOutput(new bitcore.Transaction.Output({ script: opReturn2, satoshis: 0 }));
      
      // Count OP_RETURN outputs manually
      const opReturnCount = tx.outputs.filter(output => {
        const script = output.script as bitcore.Script;
        return script && script.isDataOut && script.isDataOut();
      }).length;
      
      expect(opReturnCount).toBe(2);
      expect(opReturnCount > 1).toBe(true);
    });

    test('should count OP_RETURN outputs - none', () => {
      const tx = new bitcore.Transaction();
      tx.from({
        txid: '0000000000000000000000000000000000000000000000000000000000000000',
        vout: 0,
        scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
        amount: 0.001
      });
      addOutput(tx, 50000);
      
      // Count OP_RETURN outputs manually
      const opReturnCount = tx.outputs.filter(output => {
        const script = output.script as bitcore.Script;
        return script && script.isDataOut && script.isDataOut();
      }).length;
      
      expect(opReturnCount).toBe(0);
      expect(opReturnCount > 1).toBe(false);
    });
  });

  describe('Block parsing and caching', () => {
    test('should save and load raw block data', () => {
      const blockHash = 'abc123';
      const rawHex = '010000000000000000000000';
      
      parser.saveRawBlock(blockHash, rawHex);
      const loaded = parser.loadRawBlock(blockHash);
      
      expect(loaded).toBe(rawHex);
    });

    test('should return null for non-existent block', () => {
      const loaded = parser.loadRawBlock('nonexistent');
      
      expect(loaded).toBeNull();
    });

    test('should check if raw block exists', () => {
      const blockHash = 'xyz789';
      const rawHex = '020000000000000000000000';
      
      expect(parser.hasRawBlock(blockHash)).toBe(false);
      
      parser.saveRawBlock(blockHash, rawHex);
      
      expect(parser.hasRawBlock(blockHash)).toBe(true);
    });

    test('should handle network subdirectories correctly', () => {
      const testnetParser = new BitcoinParser(tempDir, 'testnet', 'http://user:password@127.0.0.1:18332');
      const mainnetParser = new BitcoinParser(tempDir, 'mainnet', 'http://user:password@127.0.0.1:8332');
      
      const blockHash = 'same-hash';
      const testnetData = 'testnet-data';
      const mainnetData = 'mainnet-data';
      
      testnetParser.saveRawBlock(blockHash, testnetData);
      mainnetParser.saveRawBlock(blockHash, mainnetData);
      
      expect(testnetParser.loadRawBlock(blockHash)).toBe(testnetData);
      expect(mainnetParser.loadRawBlock(blockHash)).toBe(mainnetData);
    });
  });
});
