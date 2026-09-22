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
}
