import type { TableRun } from '../core/api/table-run.model';
import { runProgress } from './table-run';

const run = (overrides: Partial<TableRun> = {}): TableRun => ({
  runId: 'run-1',
  status: 'running',
  startedAt: '2026-09-23T09:00:00.000Z',
  finishedAt: null,
  scannedItems: 0,
  estimatedItems: null,
  errorCode: null,
  ...overrides,
});

describe('runProgress', () => {
  it('is the share of the estimated table read so far', () => {
    expect(runProgress(run({ scannedItems: 1250, estimatedItems: 5000 }))).toBe(25);
  });

  it('never claims to be done while the run is still reading', () => {
    // The estimate lags the table by hours, so the count can run past it.
    expect(runProgress(run({ scannedItems: 6000, estimatedItems: 5000 }))).toBe(99);
  });

  it('has no share without an estimate', () => {
    expect(runProgress(run({ scannedItems: 1250, estimatedItems: null }))).toBeNull();
    expect(runProgress(run({ scannedItems: 0, estimatedItems: 0 }))).toBeNull();
  });
});
