import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Button } from 'primeng/button';
import { environment } from '../../environments/environment';
import { AdminSession } from '../core/auth/admin-session';
import { AuthService } from '../core/auth/auth.service';
import { LOGIN_PATH } from '../core/auth/session-expiry';
import type { TranslationKey } from '../i18n/translations';
import { TranslatePipe } from '../i18n/translate.pipe';
import { LanguageSwitcher } from '../shared/language-switcher';
import { NAV_SECTIONS } from './nav-sections';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Button, TranslatePipe, LanguageSwitcher],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
  host: { '(keydown.escape)': 'closeNavigation()' },
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);

  protected readonly sections = NAV_SECTIONS;
  protected readonly stage = environment.stage;
  protected readonly stageLabelKey: TranslationKey = `env.${environment.stage}`;
  protected readonly admin = this.session.admin;
  protected readonly signingOut = signal(false);
  protected readonly navigationOpen = signal(false);
  private readonly menuToggle = viewChild<ElementRef<HTMLButtonElement>>('menuToggle');

  protected closeNavigation(): void {
    if (!this.navigationOpen()) return;
    this.navigationOpen.set(false);
    this.menuToggle()?.nativeElement.focus();
  }

  protected async signOut(): Promise<void> {
    this.signingOut.set(true);
    await this.auth.signOut();
    this.session.clear();
    await this.router.navigateByUrl(LOGIN_PATH);
  }
}
