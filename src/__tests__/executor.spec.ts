import { createInputLockGroup } from '../executor';
import { createSigningGroup } from '../helper';
import { Tx } from '../types';

// timeout up to 120s
jest.setTimeout(1000 * 120);

test('test add', async () => {
  const tx: Tx = {
    inputs: [
      {
        data: '0x',
        block_number: '0x339',
        cell_output: {
          capacity: '0x2ecbd9bafb',
          lock: {
            args: '0xc8328aabcd9b9e8e64fbc566c4385c3bdeb219d7',
            code_hash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
            hash_type: 'type',
          },
        },
        out_point: {
          index: '0x0',
          tx_hash: '0xc549c6b58a7634b819c9f6d61b4ed64a4266924f0863e6c3da94e31d161152ab',
        },
      },
    ],
    outputs: [
      {
        cell_output: {
          capacity: '0x2540be400',
          lock: {
            code_hash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
            hash_type: 'type',
            args: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
          },
        },
        data: '0x',
      },
      {
        cell_output: {
          capacity: '0x2c71d7f413',
          lock: {
            code_hash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
            hash_type: 'type',
            args: '0xc8328aabcd9b9e8e64fbc566c4385c3bdeb219d7',
          },
        },
        data: '0x',
      },
    ],
    outputs_data: [],
    cell_deps: [
      {
        dep_type: 'dep_group',
        out_point: {
          index: '0x0',
          tx_hash: '0x6ddc6718014b7ad50121b95bb25ff61b4445b6c57ade514e7d08447e025f9f30',
        },
      },
    ],
    header_deps: [],
    version: '0x0',
    witnesses: [
      {
        lock: '0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        input_type: '',
        output_type: '',
      },
      {
        lock: '',
        input_type: '',
        output_type: '',
      },
    ],
  };

  expect(createSigningGroup(tx, createInputLockGroup(tx))).toEqual([
    {
      indexes: [0],
      message: '0x33cedc3585700feadd0a026da9549f338c9f0d1b071244da34c186761908bfe2',
      script: {
        args: '0xc8328aabcd9b9e8e64fbc566c4385c3bdeb219d7',
        code_hash: '0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8',
        hash_type: 'type',
      },
    },
  ]);
});
