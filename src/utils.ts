import { core, WitnessArgs } from '@ckb-lumos/base';
import { normalizers, Reader } from 'ckb-js-toolkit';

const R = (x: string | ArrayBuffer | Reader): Reader => new Reader(x);

export function createUnsignedWitness(witnessArgs: WitnessArgs) {
  return R(core.SerializeWitnessArgs(normalizers.NormalizeWitnessArgs(witnessArgs))).serializeJson();
}

export function HexNumber(x: bigint | number) {
  return '0x' + x.toString(16);
}
