import { utils } from '@ckb-lumos/base';
import { ScriptConfig } from '@ckb-lumos/config-manager';
import { RPC } from '@ckb-lumos/rpc';

function nonNullable<X>(x: X): NonNullable<X> {
  if (x == null) throw new Error('null check failed');
  return x as NonNullable<X>;
}

export async function loadSecp256k1ScriptDep(rpc: RPC): Promise<ScriptConfig> {
  const genesisBlock = await rpc.get_block_by_number('0x0');

  if (!genesisBlock) throw new Error('cannot load genesis block');

  const secp256k1DepTxHash = nonNullable(genesisBlock.transactions[1]).hash;
  const typeScript = nonNullable(nonNullable(genesisBlock.transactions[0]).outputs[1]).type;

  if (!secp256k1DepTxHash) throw new Error('Cannot load secp256k1 transaction');
  if (!typeScript) throw new Error('cannot load secp256k1 type script');

  const secp256k1TypeHash = utils.computeScriptHash(typeScript);

  return {
    HASH_TYPE: 'type',
    CODE_HASH: secp256k1TypeHash,
    INDEX: '0x0',
    TX_HASH: secp256k1DepTxHash,
    DEP_TYPE: 'dep_group',
  };
}
