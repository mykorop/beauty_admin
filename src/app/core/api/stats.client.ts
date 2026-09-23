import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';

/** How many profiles of one kind there are, split the way their table splits them. */
export type ProfileCounts = {
  /** Every profile of the kind — Заблоковані and Видалені among them, unlike the everyday table. */
  total: number;
  active: number;
  blocked: number;
  deleted: number;
};

/** Базові показники: the size of the platform, and how old the numbers behind it are. */
export type BasicStats = {
  /**
   * The oldest of the three listing build times the backend counted from — the counters are no
   * fresher than this, whatever the moment of the response.
   */
  builtAt: string;
  salons: ProfileCounts;
  independentMasters: ProfileCounts;
  /** Every Майстер on a Ростер. A Власник-майстер is counted as his Салон, not here. */
  salonMasters: ProfileCounts;
  clients: ProfileCounts;
};

/** New registrations of one day — or of one week, keyed by its Monday. */
export type GrowthDay = { day: string; salons: number; masters: number; clients: number };

/**
 * The Записи whose start falls on one day, by state. «Заброньовано» comes split by the clock:
 * `pastBooked` has already begun — almost always a visit nobody closed — `upcoming` is still ahead.
 */
export type AppointmentsDay = {
  day: string;
  upcoming: number;
  pastBooked: number;
  completed: number;
  cancelled: number;
  noShow: number;
};

/** Вартість Записів of one day in MDL — without the cancelled and the no-shows. Not revenue. */
export type AppointmentValueDay = { day: string; past: number; ahead: number };

/**
 * The last result of the Детальна статистика. Days are `YYYY-MM-DD` on the platform's calendar
 * (`timeZone`, Chișinău), dense — a quiet day is a zero, not a gap — from the first day anything
 * happened to today, or later where Записи are booked ahead.
 */
export type DetailedStats = {
  runId: string;
  /** When the table was read: «зараз» for everything the figures call past or ahead. */
  builtAt: string;
  timeZone: string;
  /** When the exchange rates the values were converted at were fetched; `null` for the defaults. */
  ratesUpdatedAt: string | null;
  scannedItems: number;
  /** The platform's calendar date at `builtAt`. */
  today: string;
  growth: { daily: GrowthDay[]; weekly: GrowthDay[]; undated: number };
  appointments: { daily: AppointmentsDay[]; undated: number };
  value: { currency: 'MDL'; daily: AppointmentValueDay[]; unconverted: number };
};

/** One run of the Детальна статистика, as the dashboard follows it. */
export type DetailedStatsRun = {
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

/** The latest run and the latest result — independent: a run under way keeps the last result shown. */
export type DetailedStatsState = { run: DetailedStatsRun | null; result: DetailedStats | null };

@Injectable({ providedIn: 'root' })
export class StatsClient {
  private readonly http = inject(HttpClient);

  /**
   * Базові показники. The backend tallies them from the very listings the three tables are served
   * from, so `refresh` rebuilds those — the dashboard and the lists come back fresh together.
   */
  basic(options: { refresh?: boolean } = {}): Observable<BasicStats> {
    return this.http.get<BasicStats>(adminApiUrl('/admin/stats/basic'), {
      params: options.refresh ? { refresh: 'true' } : {},
    });
  }

  /** The latest run of the Детальна статистика and its latest result — what the dashboard polls. */
  detailed(): Observable<DetailedStatsState> {
    return this.http.get<DetailedStatsState>(adminApiUrl('/admin/stats/detailed'));
  }

  /**
   * Starts the Детальна статистика — a read of the whole table, done by a backend worker — and
   * answers with the run to follow. While one is under way, the backend hands back that one.
   */
  startDetailed(): Observable<DetailedStatsRun> {
    return this.http.post<DetailedStatsRun>(adminApiUrl('/admin/stats/detailed'), null);
  }
}
