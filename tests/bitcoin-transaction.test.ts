import { BitcoinTransaction, BitcoinInput, BitcoinOutput } from '../src/bitcoin';

describe('BitcoinTransaction Stub Class', () => {
  describe('BitcoinInput', () => {
    test('should create input with required properties', () => {
      const input = new BitcoinInput('abc123', 0, 1000);
      
      expect(input.txid).toBe('abc123');
      expect(input.vout).toBe(0);
      expect(input.value).toBe(1000);
      expect(input.scriptSig).toBeInstanceOf(Buffer);
    });

    test('should create input with custom scriptSig', () => {
      const scriptSig = Buffer.from('custom script');
      const input = new BitcoinInput('abc123', 0, 1000, scriptSig);
      
      expect(input.scriptSig).toBe(scriptSig);
    });
  });

  describe('BitcoinOutput', () => {
    test('should create regular output', () => {
      const output = new BitcoinOutput(1000, Buffer.from('script'));
      
      expect(output.value).toBe(1000);
      expect(output.scriptPubKey).toBeInstanceOf(Buffer);
      expect(output.isOpReturn).toBe(false);
      expect(output.data).toBe(null);
    });

    test('should create OP_RETURN output', () => {
      const data = Buffer.from('opreturn data');
      const output = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, data);
      
      expect(output.value).toBe(0);
      expect(output.isOpReturn).toBe(true);
      expect(output.data).toBe(data);
    });
  });

  describe('BitcoinTransaction', () => {
    test('should create transaction with inputs and outputs', () => {
      const input = new BitcoinInput('input1', 0, 1000);
      const output = new BitcoinOutput(900, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [input], [output]);
      
      expect(tx.txid).toBe('tx123');
      expect(tx.inputs).toHaveLength(1);
      expect(tx.outputs).toHaveLength(1);
      expect(tx.locktime).toBe(0);
      expect(tx.version).toBe(1);
    });

    test('should create transaction with custom locktime and version', () => {
      const input = new BitcoinInput('input1', 0, 1000);
      const output = new BitcoinOutput(900, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [input], [output], 100, 2);
      
      expect(tx.locktime).toBe(100);
      expect(tx.version).toBe(2);
    });

    test('should filter OP_RETURN outputs', () => {
      const input = new BitcoinInput('input1', 0, 1000);
      const regularOutput = new BitcoinOutput(900, Buffer.from('script'));
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, Buffer.from('data'));
      const tx = new BitcoinTransaction('tx123', [input], [regularOutput, opReturnOutput]);
      
      expect(tx.opReturnOutputs).toHaveLength(1);
      expect(tx.opReturnOutputs[0]).toBe(opReturnOutput);
      expect(tx.regularOutputs).toHaveLength(1);
      expect(tx.regularOutputs[0]).toBe(regularOutput);
    });

    test('should calculate total input value', () => {
      const input1 = new BitcoinInput('input1', 0, 1000);
      const input2 = new BitcoinInput('input2', 0, 500);
      const output = new BitcoinOutput(1400, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [input1, input2], [output]);
      
      expect(tx.totalInputValue).toBe(1500);
    });

    test('should calculate total output value', () => {
      const input = new BitcoinInput('input1', 0, 1000);
      const output1 = new BitcoinOutput(800, Buffer.from('script1'));
      const output2 = new BitcoinOutput(100, Buffer.from('script2'));
      const tx = new BitcoinTransaction('tx123', [input], [output1, output2]);
      
      expect(tx.totalOutputValue).toBe(900);
    });

    test('should calculate transaction fee', () => {
      const input = new BitcoinInput('input1', 0, 1000);
      const output = new BitcoinOutput(900, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [input], [output]);
      
      expect(tx.fee).toBe(100);
    });

    test('should check for single OP_RETURN', () => {
      const input = new BitcoinInput('input1', 0, 1000);
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, Buffer.from('data'));
      const tx = new BitcoinTransaction('tx123', [input], [opReturnOutput]);
      
      expect(tx.hasSingleOpReturn).toBe(true);
    });

    test('should return false for multiple OP_RETURN outputs', () => {
      const input = new BitcoinInput('input1', 0, 1000);
      const opReturn1 = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, Buffer.from('data1'));
      const opReturn2 = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, Buffer.from('data2'));
      const tx = new BitcoinTransaction('tx123', [input], [opReturn1, opReturn2]);
      
      expect(tx.hasSingleOpReturn).toBe(false);
    });

    test('should return false for no OP_RETURN outputs', () => {
      const input = new BitcoinInput('input1', 0, 1000);
      const output = new BitcoinOutput(900, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [input], [output]);
      
      expect(tx.hasSingleOpReturn).toBe(false);
    });

    test('should get OP_RETURN data', () => {
      const input = new BitcoinInput('input1', 0, 1000);
      const data = Buffer.from('opreturn data');
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, data);
      const tx = new BitcoinTransaction('tx123', [input], [opReturnOutput]);
      
      expect(tx.opReturnData).toBe(data);
    });

    test('should return null for no OP_RETURN data', () => {
      const input = new BitcoinInput('input1', 0, 1000);
      const output = new BitcoinOutput(900, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [input], [output]);
      
      expect(tx.opReturnData).toBe(null);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty inputs and outputs', () => {
      const tx = new BitcoinTransaction('tx123', [], []);
      
      expect(tx.inputs).toHaveLength(0);
      expect(tx.outputs).toHaveLength(0);
      expect(tx.totalInputValue).toBe(0);
      expect(tx.totalOutputValue).toBe(0);
      expect(tx.fee).toBe(0);
    });

    test('should handle zero value inputs and outputs', () => {
      const input = new BitcoinInput('input1', 0, 0);
      const output = new BitcoinOutput(0, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [input], [output]);
      
      expect(tx.totalInputValue).toBe(0);
      expect(tx.totalOutputValue).toBe(0);
      expect(tx.fee).toBe(0);
    });

    test('should handle large values', () => {
      const input = new BitcoinInput('input1', 0, 2100000000000000); // Max supply
      const output = new BitcoinOutput(2100000000000000, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [input], [output]);
      
      expect(tx.totalInputValue).toBe(2100000000000000);
      expect(tx.totalOutputValue).toBe(2100000000000000);
      expect(tx.fee).toBe(0);
    });
  });

  describe('isUBB method', () => {
    test('should return true for transaction with known deed UTXO', () => {
      const deedInput = new BitcoinInput('deed123', 0, 600);
      const output = new BitcoinOutput(500, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [deedInput], [output]);
      
      const ubbDeedUTXOs = ['deed123:0', 'other456:1'];
      
      expect(tx.isUBB(ubbDeedUTXOs)).toBe(true);
    });

    test('should return true for transaction with UBB magic bytes in OP_RETURN', () => {
      const input = new BitcoinInput('input123', 0, 1000);
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, Buffer.from([0x13, 0x37, 0x01, 0x01]));
      const tx = new BitcoinTransaction('tx123', [input], [opReturnOutput]);
      
      expect(tx.isUBB()).toBe(true);
    });

    test('should return false for transaction without deed UTXO or magic bytes', () => {
      const input = new BitcoinInput('input123', 0, 1000);
      const output = new BitcoinOutput(900, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [input], [output]);
      
      expect(tx.isUBB()).toBe(false);
    });

    test('should return false for transaction with non-UBB OP_RETURN', () => {
      const input = new BitcoinInput('input123', 0, 1000);
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, Buffer.from([0x12, 0x34, 0x01, 0x01]));
      const tx = new BitcoinTransaction('tx123', [input], [opReturnOutput]);
      
      expect(tx.isUBB()).toBe(false);
    });

    test('should return false for transaction with short OP_RETURN', () => {
      const input = new BitcoinInput('input123', 0, 1000);
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, Buffer.from([0x13])); // Too short
      const tx = new BitcoinTransaction('tx123', [input], [opReturnOutput]);
      
      expect(tx.isUBB()).toBe(false);
    });

    test('should return false for transaction with no OP_RETURN', () => {
      const input = new BitcoinInput('input123', 0, 1000);
      const output = new BitcoinOutput(900, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [input], [output]);
      
      expect(tx.isUBB()).toBe(false);
    });

    test('should prioritize deed UTXO over OP_RETURN magic bytes', () => {
      const deedInput = new BitcoinInput('deed123', 0, 600);
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, Buffer.from([0x12, 0x34])); // Wrong magic
      const tx = new BitcoinTransaction('tx123', [deedInput], [opReturnOutput]);
      
      const ubbDeedUTXOs = ['deed123:0'];
      
      expect(tx.isUBB(ubbDeedUTXOs)).toBe(true);
    });

    test('should handle empty deed UTXO list', () => {
      const input = new BitcoinInput('input123', 0, 1000);
      const opReturnOutput = new BitcoinOutput(0, Buffer.from('OP_RETURN'), true, Buffer.from([0x13, 0x37, 0x01, 0x01]));
      const tx = new BitcoinTransaction('tx123', [input], [opReturnOutput]);
      
      expect(tx.isUBB([])).toBe(true);
    });

    test('should handle multiple inputs with one being deed UTXO', () => {
      const regularInput = new BitcoinInput('input123', 0, 1000);
      const deedInput = new BitcoinInput('deed456', 1, 600);
      const output = new BitcoinOutput(1500, Buffer.from('script'));
      const tx = new BitcoinTransaction('tx123', [regularInput, deedInput], [output]);
      
      const ubbDeedUTXOs = ['deed456:1'];
      
      expect(tx.isUBB(ubbDeedUTXOs)).toBe(true);
    });
  });
});
