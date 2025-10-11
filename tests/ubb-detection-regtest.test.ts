import * as bitcore from 'bitcore-lib';
import { BitcoinParser } from '../src/indexer/bitcoin-parser';
import { UBBOpReturnData } from '../src/transactions/ubb-op-return-data';

// Raw tx hex from local node (regtest)
const TX_HEX = "020000000001012bdae7decabd6f48ac0f483d1d50e20ee7f51162d39c16314a8b4e73ae9fc2dd0000000000fdffffff030000000000000000a56a4ca21337010100000000424d9a000000000000008a0000007c0000000200000002000000010018000000000010000000232e0000232e000000000000000000000000ff0000ff0000ff000000000000004247527300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000ffffffffffff0000ffffffffffff000058020000000000001600149e9dae26f1b332f06d6bfe19096e95e9746876cd606b042a0100000016001432b7d573ff0bd58f9b9b118ca3baf4e8d4a0502b0247304402201cb3d17c33258775067ec6d8577e77e9a9577f778bb052b6dfc3ae89e9c0266e02205c0747af014967c4038e08b178f205cc5479ec8ae3a522ae31ce2a84163ed0420121029f489d4600a853c1fd906590fecff2c85408bb1f213281203d6ca78c95273e5f00000000";

describe('Regtest UBB detection (raw hex)', () => {
  const parser = new BitcoinParser('./data', 'testnet', 'http://user:password@127.0.0.1:18332');

  it('detects OP_RETURN with UBB magic bytes', () => {
    const tx = new bitcore.Transaction(TX_HEX);
    expect(parser.isUBBTransaction(tx, [])).toBe(true);

    const data = parser.extractOpReturnData(tx);
    expect(data).toBeTruthy();
    if (!data) return;
    expect(data.slice(0, 3).toString('hex')).toBe('133701');
  });

  it('fails parsing UBB OP_RETURN without required CBOR URI for CLAIM', () => {
    const tx = new bitcore.Transaction(TX_HEX);
    const data = parser.extractOpReturnData(tx);
    expect(data).toBeTruthy();
    if (!data) return;

    const ubb = new UBBOpReturnData(data);
    expect(ubb.isValid).toBe(false);
  });
});


