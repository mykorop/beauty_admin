import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { adminApiUrl } from './admin-api-url';

export type SalonStatus = 'active' | 'blocked' | 'deleted';

export type SalonListItem = {
  salonId: string;
  name: string;
  city: string;
  cityCode: string;
  /** Власник салону; empty on salons registered before owners gave their name. */
  ownerName: string;
  email: string;
  phone: string;
  rating: number;
  reviewCount: number;
  status: SalonStatus;
  createdAt: string;
};

export type SalonList = {
  items: SalonListItem[];
  /** When `admin-api` built the list from the table — it is cached for a few minutes. */
  builtAt: string;
};

@Injectable({ providedIn: 'root' })
export class SalonsClient {
  private readonly http = inject(HttpClient);

  /** The whole platform in one response; `refresh` makes the backend rebuild its cached list. */
  list(options: { refresh?: boolean } = {}): Observable<SalonList> {
    return this.http.get<SalonList>(adminApiUrl('/admin/salons'), {
      params: options.refresh ? { refresh: 'true' } : {},
    });
  }
}
