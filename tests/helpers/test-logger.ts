/**
 * Test Logger Helper
 * 
 * Suppresses console output during tests unless TEST_VERBOSE=true
 * 
 * Usage:
 *   TEST_VERBOSE=true npm test  # Show all console output
 *   npm test                     # Silent mode (default)
 */

const isVerbose = process.env.TEST_VERBOSE === 'true';

// Store original console methods at module load time
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;
const originalInfo = console.info;

export function suppressConsoleInTests() {
  if (!isVerbose) {
    // Suppress immediately when called (not in beforeAll)
    console.log = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    console.error = jest.fn();

    // Restore after all tests
    afterAll(() => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.info = originalInfo;
    });
  }
}

/**
 * Usage in test files:
 * 
 * import { suppressConsoleInTests } from './helpers/test-logger';
 * 
 * suppressConsoleInTests();
 * 
 * describe('My tests', () => {
 *   // Tests run silently unless TEST_VERBOSE=true
 * });
 * 
 * To see logs: TEST_VERBOSE=true npm test
 */
