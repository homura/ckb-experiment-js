import { Cell, CellDep, Hash, HexNumber, HexString, Script, WitnessArgs } from '@ckb-lumos/base';

export interface Tx {
  cell_deps: CellDep[];
  hash?: Hash;
  header_deps: Hash[];
  inputs: Cell[];
  outputs: Cell[];
  outputs_data: HexString[];
  version: HexNumber;
  witnesses: WitnessArgs[];
}

export type ScriptTemplate = Omit<Script, 'args'>;

export interface ScriptManager {
  placeholderOfWitnessLock: (script: Script) => HexString;
  getCellDeps: (scriptTemplate: ScriptTemplate) => CellDep[];
}

export interface Signer {
  sign(message: HexString, script: Script, tx: Tx): Promisable<HexString>;
}

export type Promisable<T> = Promise<T> | T;

export interface AssemblerExecutor {
  execute(assembler: TxAssembler): Promise<Tx>;
}

export interface ScriptGroup {
  indexes: number[];
  script: Script;
}

export interface SigningGroup extends ScriptGroup {
  message: HexString;
}

// prettier-ignore
export type CellPair =
  | [Cell, Cell]
  | [undefined, Cell]
  | [Cell, undefined];

export interface TxAssembler {
  inputsAndOutputs?: (draftTx: Tx) => Promisable<void>;

  // prettier-ignore
  /**
   * inject is not yet enough capacity, some additional CKB will be added as a fee
   * @param needed capacity(output - input + 1 ckb) The additional 1CKB will be deducted from the change cell when payFee calculates the fee
   * @param tx
   * @param context
   */
  injectCapacity?: (draftTx: Tx, payload: { neededCapacity: bigint }) => Promisable<void>;

  /**
   * fill cellDeps by unique script templates
   */
  cellDeps?: (draftTx: Tx, templates: { scriptTemplates: ScriptTemplate[] }) => Promisable<void>;

  headerDeps?: (draftTx: Tx) => Promisable<void>;

  // prettier-ignore
  typeWitnesses?: (draftTx: Tx, cellPairs: CellPair[]) => void;

  // prettier-ignore
  prepareSigningEntries?: (draftTx: Tx, entries: { lockGroup: ScriptGroup[] }) => Promisable<void>;

  payFee?: (tx: Tx, fee: { txFee: bigint }) => Promisable<void>;

  signAndSeal?: (tx: Tx, signingEntries: { entries: SigningGroup[] }) => Promisable<void>;
}
