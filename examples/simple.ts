import { Cell, HexString, Script } from '@ckb-lumos/base';
import { key } from '@ckb-lumos/hd';
import { minimalCellCapacity } from '@ckb-lumos/helpers';
import { RPC } from '@ckb-lumos/rpc';
import {
  CkbIndexer,
  Collector,
  TxAssembler,
  createDefaultTxAssemblerExecutor,
  createRpcTransactionFromTx,
} from '../src';
import { loadSecp256k1ScriptDep } from '../src/system-script';
import { HexNumber } from '../src/utils';

async function main() {
  // default test private key of Tippy, lock args: 0xc8328aabcd9b9e8e64fbc566c4385c3bdeb219d7
  const capacity = 100_00000000n;
  const privateKey = '0xd00c06bfd800d27397002dca6fb0993d5ba6399b4238b2f29ee9deb97593d2bc';
  const senderLockArgs: HexString = '0xc8328aabcd9b9e8e64fbc566c4385c3bdeb219d7';
  const receiverLockArgs: HexString = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

  const collector = new Collector(new CkbIndexer('http://localhost:8116'));
  const rpc = new RPC('http://localhost:8114');

  const SECP256K1 = await loadSecp256k1ScriptDep(rpc);
  const senderLock: Script = { code_hash: SECP256K1.CODE_HASH, hash_type: SECP256K1.HASH_TYPE, args: senderLockArgs };
  const receiverLock: Script = {
    code_hash: SECP256K1.CODE_HASH,
    hash_type: SECP256K1.HASH_TYPE,
    args: receiverLockArgs,
  };

  const transferAssembler: TxAssembler = {
    async inputsAndOutputs(tx) {
      const receiverCell: Cell = {
        cell_output: { capacity: HexNumber(capacity), lock: receiverLock },
        data: '0x',
      };
      tx.outputs.push(receiverCell);
    },

    async injectCapacity(tx, { neededCapacity }) {
      const changeCell = { cell_output: { capacity: '0x0', lock: senderLock }, data: '0x' };
      const changeCellOccupied = minimalCellCapacity(changeCell);

      const collected = await collector.collectCapacity({
        capacity: neededCapacity + changeCellOccupied,
        fromLock: senderLock,
      });

      changeCell.cell_output.capacity = HexNumber(collected.totalCapacity - neededCapacity);

      tx.inputs.push(...collected.cells);
      tx.outputs.push(changeCell);
    },

    cellDeps(tx) {
      tx.cell_deps.push({
        dep_type: SECP256K1.DEP_TYPE,
        out_point: { index: SECP256K1.INDEX, tx_hash: SECP256K1.TX_HASH },
      });
    },

    typeWitnesses() {
      // nothing to do here since we dont need input_type or output_type witnesses
    },

    prepareSigningEntries(tx, { lockGroup }) {
      const { indexes } = lockGroup[0];
      // secp256k1 signature is 65 bytes
      tx.witnesses[indexes[0]].lock = '0x' + '00'.repeat(65);
    },

    payFee(tx, { txFee }) {
      const changeCell = tx.outputs[tx.outputs.length - 1].cell_output;
      changeCell.capacity = HexNumber(BigInt(changeCell.capacity) - txFee);
    },

    async signAndSeal(tx, { entries }) {
      const { message } = entries[0];
      tx.witnesses[0].lock = key.signRecoverable(message, privateKey);
    },
  };

  const executor = createDefaultTxAssemblerExecutor();
  const tx = createRpcTransactionFromTx(await executor.execute(transferAssembler));
  const txHash = await rpc.send_transaction(tx);
  console.log(txHash);
}

main();
