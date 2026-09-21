import { Injectable, signal } from '@angular/core';
import type { SalonMaster } from '../../core/api/salon-masters.client';

/**
 * The Майстер салону the open card is about. Provided by `SalonMasterCardPage` next to the
 * `SalonCardStore` of his Салон, read by the card's tabs.
 */
@Injectable()
export class SalonMasterStore {
  readonly master = signal<SalonMaster | null>(null);
}
