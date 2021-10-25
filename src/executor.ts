import { core, Transaction } from '@ckb-lumos/base';
import { minimalCellCapacity } from '@ckb-lumos/helpers';
import { normalizers, Reader } from 'ckb-js-toolkit';
import produce from 'immer';
import { compact, find, isEqual, range, uniqWith, zip } from 'lodash';
import { calculateFee, createSigningGroup, getTransactionSizeByTx } from './helper';
import { AssemblerExecutor, CellPair, ScriptGroup, Tx } from './types';

export function createRpcTransactionFromTx(tx: Tx): Transaction {
  return {
    inputs: tx.inputs.map((cell) => ({ since: '0x0', previous_output: cell.out_point! })),
    outputs: tx.outputs.map((cell) => cell.cell_output),
    outputs_data: tx.outputs.map((cell) => cell.data),
    cell_deps: tx.cell_deps,
    header_deps: tx.header_deps,
    witnesses: tx.witnesses.map((item) =>
      new Reader(core.SerializeWitnessArgs(normalizers.NormalizeWitnessArgs(item))).serializeJson(),
    ),
    version: tx.version,
  };
}

function createEmptyTx(): Tx {
  return {
    inputs: [],
    outputs: [],
    outputs_data: [],

    cell_deps: [],
    header_deps: [],

    version: '0x0',
    witnesses: [],
  };
}

const BigIntMath = {
  max(a: bigint, b: bigint) {
    return a > b ? a : b;
  },
};

export function createInputLockGroup(tx: Tx): ScriptGroup[] {
  return tx.inputs
    .map((cell) => cell.cell_output.lock)
    .reduce<ScriptGroup[]>((group, lock, index) => {
      const found = find(group, (item) => isEqual(item.script, lock));

      if (!found) return group.concat({ script: lock, indexes: [index] });

      found.indexes.push(index);
      return group;
    }, []);
}

export function createDefaultTxAssemblerExecutor(): AssemblerExecutor {
  let tx = createEmptyTx();

  return {
    async execute(assembler): Promise<Tx> {
      tx = await produce(tx, async (draft) => assembler.inputsAndOutputs?.(draft));

      // TODO check input and output
      if (assembler.injectCapacity) {
        const outputCapacity = tx.outputs.reduce(
          (total, cell) => BigIntMath.max(minimalCellCapacity(cell), BigInt(cell.cell_output.capacity)) + total,
          0n,
        );
        const inputCapacity = tx.inputs.reduce((total, cell) => BigInt(cell.cell_output.capacity) + total, 0n);
        // TODO refactor hardcoded
        const additionalFee = 10n ** 8n;

        const needToInjectCapacity = outputCapacity + additionalFee > inputCapacity;

        if (needToInjectCapacity) {
          const neededAndAdditionalFee = outputCapacity + additionalFee - inputCapacity;

          tx = await produce(tx, async (draft) => {
            await assembler.injectCapacity?.(draft, { neededCapacity: neededAndAdditionalFee });
          });
        }
      }
      // TODO check injected capacity

      if (assembler.cellDeps) {
        tx = produce(tx, (draft) => {
          const inputLocks = tx.inputs.map((x) => x.cell_output.lock);
          const inputTypes = compact(tx.inputs.map((x) => x.cell_output.type));
          const outputTypes = compact(tx.outputs.map((x) => x.cell_output.type));

          const scriptTemplates = uniqWith([...inputLocks, ...inputTypes, ...outputTypes], isEqual);

          assembler.cellDeps?.(draft, { scriptTemplates });
        });
      }

      if (assembler.headerDeps) {
        tx = produce(tx, (draft) => {
          assembler.headerDeps?.(draft);
        });
      }

      if (assembler.typeWitnesses) {
        const cellPairs = zip(tx.inputs, tx.outputs) as CellPair[];

        tx = await produce(tx, async (draft) => {
          await assembler.typeWitnesses?.(draft, cellPairs);
        });
      }

      let inputLockGroup: ScriptGroup[] | null = null;
      if (assembler.prepareSigningEntries) {
        inputLockGroup = createInputLockGroup(tx);

        tx = await produce(tx, async (draft) => {
          range(0, Math.max(draft.inputs.length, draft.outputs.length)).forEach((i) => {
            draft.witnesses[i] = draft.witnesses[i] || { lock: '', input_type: '', output_type: '' };
          });

          await assembler.prepareSigningEntries?.(draft, { lockGroup: inputLockGroup! });
        });
      }

      if (assembler.payFee) {
        // TODO refactor hardcoded fee rate
        const rcpTransaction = createRpcTransactionFromTx(tx);
        const txFee = calculateFee(getTransactionSizeByTx(rcpTransaction), 1000n);

        tx = produce(tx, (draft) => {
          assembler.payFee?.(draft, { txFee });
        });
      }

      if (assembler.signAndSeal && inputLockGroup) {
        const entries = createSigningGroup(tx, inputLockGroup);
        tx = await produce(tx, async (draft) => {
          await assembler.signAndSeal?.(draft, { entries });
        });
      }

      return tx;
    },
  };
}
