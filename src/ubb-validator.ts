import * as fs from 'fs';
import { UBBBMP } from './ubb-bmp';
import { UBBPlot } from './ubb-plot';
import { UBBValidator } from './ubb-validator-class';
import { 
  UBBTransactionBase,
  UBBClaimTransaction,
  UBBRetryClaimTransaction,
  UBBUpdateTransaction,
  UBBTransferTransaction,
  UBBTransaction,
  UBBOpReturnData
} from './transactions';
import { BitcoinTransaction, BitcoinInput, BitcoinOutput } from './bitcoin';

/**
 * Helper function to create UBBBMP from file path
 */
function createUBBBMPFromFile(filePath: string): UBBBMP {
  const buffer = fs.readFileSync(filePath);
  return new UBBBMP(buffer);
}

export { 
  UBBBMP, 
  UBBPlot, 
  UBBValidator, 
  createUBBBMPFromFile,
  UBBTransactionBase,
  UBBClaimTransaction,
  UBBRetryClaimTransaction,
  UBBUpdateTransaction,
  UBBTransferTransaction,
  UBBTransaction,
  UBBOpReturnData,
  BitcoinTransaction,
  BitcoinInput,
  BitcoinOutput
};