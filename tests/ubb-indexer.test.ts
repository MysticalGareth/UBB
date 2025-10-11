/**
 * Tests for UBB Indexer
 */

import { UBBIndexer } from '../src/indexer/ubb-indexer';
import { IndexerConfig } from '../src/indexer/types';
import * as fs from 'fs';
import * as path from 'path';

describe('UBB Indexer', () => {
  let indexer: UBBIndexer;
  let config: IndexerConfig;
  let testDataDir: string;

  beforeEach(() => {
    // Use tests/test-data instead of root test-data to avoid IDE clutter
    testDataDir = path.join(__dirname, 'test-data');
    config = {
      dataDir: testDataDir,
      maxRetries: 3,
      retryDelay: 1000,
      rpcUrl: 'http://user:password@127.0.0.1:18443'
    };
    indexer = new UBBIndexer(config);
  });

  afterEach(() => {
    // Clean up test data directory
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  describe('Configuration', () => {
    it('should create indexer with valid config', () => {
      expect(indexer).toBeDefined();
    });

    it('should create rawblock directory on initialization', () => {
      const rawBlockDir = path.join(testDataDir, 'mainnet', 'rawblock');
      expect(fs.existsSync(rawBlockDir)).toBe(true);
    });

    // Note: states and images directories are created lazily when index() is called
    // with a genesis hash, so they won't exist until then
  });

  describe('Error Handling', () => {
    it('should handle invalid tip hash format', async () => {
      const result = await indexer.index('invalid-hash', '0000000000000000000987654321fedcba1234567890abcdef1234567890abcdef');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle invalid genesis hash format', async () => {
      const result = await indexer.index('0000000000000000000123456789abcdef1234567890abcdef1234567890abcdef', 'invalid-hash');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('State Management', () => {
    it('should have null stateManager before indexing', () => {
      const stateManager = (indexer as any).stateManager;
      expect(stateManager).toBeNull();
    });

    // Note: stateManager is created lazily when index() is called with a genesis hash
    // More comprehensive state management tests are in ubb-end-to-end-regtest.test.ts
  });
});
