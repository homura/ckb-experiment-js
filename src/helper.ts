import { core, HexString, Transaction, utils } from '@ckb-lumos/base';
import { normalizers, Reader } from 'ckb-js-toolkit';
import { createRpcTransactionFromTx, ScriptGroup, SigningGroup, Tx } from '.';

export function getTransactionSizeByTx(tx: Transaction): number {
  const serializedTx = core.SerializeTransaction(normalizers.NormalizeTransaction(tx));
  // 4 is serialized offset bytesize
  return serializedTx.byteLength + 4;
}

export function calculateFee(size: number, feeRate: bigint): bigint {
  const ratio = 1000n;
  const base = BigInt(size) * feeRate;
  const fee = base / ratio;
  if (fee * ratio < base) {
    return fee + 1n;
  }
  return fee;
}

const { ckbHash, CKBHasher } = utils;
type Hasher = InstanceType<typeof CKBHasher>;

function hashWitness(hasher: Hasher, witness: HexString): void {
  const lengthBuffer = new ArrayBuffer(8);
  const view = new DataView(lengthBuffer);
  view.setBigUint64(0, BigInt(new Reader(witness).length()), true);

  hasher.update(lengthBuffer);
  hasher.update(witness);
}

export function createSigningGroup(tx: Tx, scriptGroup: ScriptGroup[]): SigningGroup[] {
  const txHash = ckbHash(
    core.SerializeRawTransaction(normalizers.NormalizeRawTransaction(createRpcTransactionFromTx(tx))),
  ).serializeJson();
  const witnesses = tx.witnesses;

  return scriptGroup.map(({ script, indexes }) => {
    const hasher = new CKBHasher();
    hasher.update(txHash);

    indexes.forEach((inputIndex) =>
      hashWitness(
        hasher,
        new Reader(core.SerializeWitnessArgs(normalizers.NormalizeWitnessArgs(witnesses[inputIndex]))).serializeJson(),
      ),
    );

    tx.witnesses.slice(tx.inputs.length).forEach((witnessArgs) => {
      hashWitness(
        hasher,
        new Reader(core.SerializeWitnessArgs(normalizers.NormalizeWitnessArgs(witnessArgs))).serializeJson(),
      );
    });

    return {
      script,
      indexes,
      message: hasher.digestHex(),
    };
  });
}
