import { Hash, HexNumber, HexString, OutPoint, Output, Script } from '@ckb-lumos/base';
import { Client, HTTPTransport, RequestManager } from '@open-rpc/client-js';
import { expand, filter as rxFilter, from, lastValueFrom, mergeMap, Observable, scan, takeWhile } from 'rxjs';

export interface SearchKey {
  script: Script;
  script_type: 'lock' | 'type';
  filter?: {
    script?: Script;
    block_range?: [HexNumber, HexNumber];
    output_capacity_range?: [HexNumber, HexNumber];
    output_data_len_range?: [HexNumber, HexNumber];
  };
}

export interface GetCellsPayload {
  search_key: SearchKey;
  order?: 'asc' | 'desc';
  limit?: HexNumber;
  after_cursor?: HexString;
}

export interface ResolvedOutPoint {
  block_number: HexNumber;
  out_point: OutPoint;
  output: Output;
  output_data: HexString;
  tx_index: HexNumber;
}

export interface ResolvedCell {
  cell_output: {
    capacity: HexNumber;
    lock: Script;
    type?: Script;
  };
  data: HexString;
  out_point: OutPoint;
  block_number: HexNumber;
  block_hash?: Hash;
}

interface GetPayloadResponse {
  last_cursor: HexString;
  objects: ResolvedCell[];
}

export interface GetTipResponse {
  block_hash: Hash;
  block_number: HexNumber;
}

export class CkbIndexer {
  private client: Client;

  constructor(uri: string) {
    const transport = new HTTPTransport(uri, {
      headers: { 'content-type': 'application/json' },
    });
    this.client = new Client(new RequestManager([transport]));
  }

  get_cells(payload: GetCellsPayload): Promise<GetPayloadResponse> {
    const { search_key, order = 'asc', limit = '0x3e8' /*1_000*/, after_cursor } = payload;
    return this.client
      .request({
        method: 'get_cells',
        params: [search_key, order, limit, after_cursor],
      })
      .then((res: { last_cursor: HexString; objects: ResolvedOutPoint[] }) => ({
        last_cursor: res.last_cursor,
        objects: res.objects.map((item) => ({
          data: item.output_data,
          block_number: item.block_number,
          cell_output: item.output,
          out_point: item.out_point,
        })),
      }));
  }

  get_tip(): Promise<GetTipResponse> {
    return this.client.request({ method: 'get_tip' });
  }
}

interface CapacityAcc {
  totalCapacity: bigint;
  cells: ResolvedCell[];
}

export class Collector {
  constructor(private indexer: CkbIndexer) {}

  takeCells(searchKey: SearchKey): Observable<ResolvedCell> {
    const indexer = this.indexer;
    return from(indexer.get_cells({ search_key: searchKey })).pipe(
      expand((x) => indexer.get_cells({ search_key: searchKey, after_cursor: x.last_cursor })),
      takeWhile((res) => res.objects.length > 0),
      mergeMap((res) => res.objects),
    );
  }

  collectCapacity(filter: { capacity: bigint; fromLock: Script }): Promise<CapacityAcc> {
    const cells$ = this.takeCells({
      script: filter.fromLock,
      script_type: 'lock',
      filter: { output_data_len_range: ['0x0', '0x1'] },
    }).pipe(
      rxFilter((cell) => !cell.cell_output.type && cell.data === '0x'),
      scan<ResolvedCell, CapacityAcc>(
        (acc, cell) => ({
          totalCapacity: acc.totalCapacity + BigInt(cell.cell_output.capacity),
          cells: acc.cells.concat(cell),
        }),
        { totalCapacity: 0n, cells: [] },
      ),
      takeWhile((acc) => acc.totalCapacity < filter.capacity, true),
    );

    return lastValueFrom(cells$);
  }
}
