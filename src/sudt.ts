import { Cell, utils } from '@ckb-lumos/base';
import produce from 'immer';

interface BaseCell {
  _raw: Cell;
  capacity: bigint;

  toCell(): Cell;
}

interface SudtCell extends BaseCell {
  amount: bigint;
}

export function createSudtCell(cell: Cell): SudtCell {
  return {
    _raw: cell,

    toCell() {
      return produce(cell, (draft) => {
        draft.data = utils.toBigUInt128LE(this.amount);
      });
    },

    capacity: BigInt(cell.cell_output.capacity),
    amount: utils.readBigUInt128LE(cell.data),
  };
}
