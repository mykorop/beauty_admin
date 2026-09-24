import type { Page } from '@playwright/test';
import { expect } from './app.fixture';

/**
 * What the open Запис offers, whichever list it was opened from. Its card names the state of the
 * Місце it was made in (`venueStatus`), and that — not the list — decides the offers.
 */

/**
 * Over a Видалений Місце a Запис can still be cancelled — the one action over it the backend allows
 * there, so that no Клієнт is left before a closed door — and nothing else.
 */
export async function expectOnlyCancellation(page: Page): Promise<void> {
  await expect(page.getByTestId('appointment-action-CANCELLED')).toBeVisible();
  await expect(page.getByTestId('appointment-action-COMPLETED')).toHaveCount(0);
  await expect(page.getByTestId('appointment-action-NO_SHOW')).toHaveCount(0);
  await expect(page.getByTestId('appointment-action-reschedule')).toHaveCount(0);
}

/** Over a Місце that may be changed — active or Заблокований — every action a booked Запис owes. */
export async function expectEveryAction(page: Page): Promise<void> {
  await expect(page.getByTestId('appointment-action-CANCELLED')).toBeVisible();
  await expect(page.getByTestId('appointment-action-COMPLETED')).toBeVisible();
  await expect(page.getByTestId('appointment-action-NO_SHOW')).toBeVisible();
  await expect(page.getByTestId('appointment-action-reschedule')).toBeVisible();
}
