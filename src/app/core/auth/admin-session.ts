import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { type AdminIdentity, MeClient } from '../api/me.client';

/** Who the backend says is signed in — the answer of `GET /admin/me`, kept for the shell. */
@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly me = inject(MeClient);
  private readonly _admin = signal<AdminIdentity | null>(null);

  readonly admin = this._admin.asReadonly();

  /**
   * Always asks the backend, never answers from the signal: the guard calls this once per entry
   * into the shell, and the previous answer may belong to whoever was signed in before a session
   * expiry in this tab.
   */
  async load(): Promise<AdminIdentity> {
    this._admin.set(null);
    const admin = await firstValueFrom(this.me.get());
    this._admin.set(admin);
    return admin;
  }

  clear(): void {
    this._admin.set(null);
  }
}
