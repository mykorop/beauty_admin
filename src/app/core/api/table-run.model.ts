/**
 * One run of work the backend does over the whole table, off the request path — the Детальна
 * статистика's, or the gathering of one day's Записи across the platform. Both are followed the
 * same way: start, then poll until `status` leaves `running`.
 */
export type TableRun = {
  runId: string;
  status: 'running' | 'succeeded' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  /** Table rows read so far. */
  scannedItems: number;
  /** DynamoDB's estimate of the table's size — an estimate, so the count may run past it. */
  estimatedItems: number | null;
  /** `TIMED_OUT`: did not finish in the worker's time. `FAILED`: anything else. */
  errorCode: 'TIMED_OUT' | 'FAILED' | null;
};
