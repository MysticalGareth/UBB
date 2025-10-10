/**
 * Helper utilities for CLI end-to-end testing
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);

export interface CLICommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run a CLI command and return output
 */
export async function runCLICommand(command: string, cwd: string = process.cwd()): Promise<CLICommandResult> {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1
    };
  }
}

/**
 * Extract transaction ID from CLI output
 */
export function extractTxid(output: string): string | null {
  const match = output.match(/Transaction ID: ([a-f0-9]{64})/);
  return match ? match[1] : null;
}

/**
 * Extract deed UTXO from CLI output
 */
export function extractDeedUTXO(output: string): string | null {
  const match = output.match(/(?:New )?Deed UTXO: ([a-f0-9]{64}:\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract block hash from CLI output
 */
export function extractBlockHash(output: string): string | null {
  const match = output.match(/Block mined: ([a-f0-9]{64})/);
  return match ? match[1] : null;
}

/**
 * Generate a unique wallet name for test isolation
 */
export function generateTestWalletName(testName: string): string {
  const hash = crypto.createHash('sha256').update(testName + Date.now()).digest('hex').substring(0, 8);
  return `ubb_test_${hash}`;
}

/**
 * Parse CLI error message
 */
export function extractErrorMessage(output: string): string | null {
  const match = output.match(/❌[^\n]*Error: ([^\n]+)/);
  return match ? match[1] : null;
}

/**
 * Check if CLI command succeeded
 */
export function isSuccessfulCommand(result: CLICommandResult): boolean {
  return result.exitCode === 0 && result.stdout.includes('✅');
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs: number = 10000,
  intervalMs: number = 100
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  return false;
}

/**
 * Build CLI command with common parameters
 */
export function buildCLICommand(
  script: 'make-claim' | 'make-retry-claim' | 'make-update' | 'make-transfer',
  args: Record<string, string | number | boolean>
): string {
  const argParts: string[] = [];
  
  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'boolean') {
      if (value) {
        argParts.push(`--${key}`);
      }
    } else {
      argParts.push(`--${key} ${value}`);
    }
  }
  
  return `npm run ${script} -- ${argParts.join(' ')}`;
}
