import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { type Observable, shareReplay } from 'rxjs';
import { adminApiUrl } from './admin-api-url';

/** Платформні довідники — stored labels, read-only; the panel translates them. */
export type Dictionaries = {
  serviceCategories: string[];
  specializations: string[];
  /** What a new service may be priced in — MDL only, as for the business itself. */
  serviceCurrencies: string[];
};

/**
 * `GET /admin/dictionaries` — the platform's own lists, not any one business's. It lives apart from
 * the Каталог clients because both of them read it: a Салон's catalog editor and a Незалежний
 * майстер's are one component, and it may not reach into a salon-named module for this.
 */
@Injectable({ providedIn: 'root' })
export class DictionariesClient {
  private readonly http = inject(HttpClient);
  private cached: Observable<Dictionaries> | null = null;

  /** Fixed platform lists: read once per session; a failed read is not remembered. */
  get(): Observable<Dictionaries> {
    return (this.cached ??= this.http
      .get<Dictionaries>(adminApiUrl('/admin/dictionaries'))
      .pipe(shareReplay({ bufferSize: 1, refCount: false })));
  }
}
