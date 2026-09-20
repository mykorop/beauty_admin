import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Button } from 'primeng/button';
import { InputOtp } from 'primeng/inputotp';
import { InputText } from 'primeng/inputtext';
import { Message } from 'primeng/message';
import { Password } from 'primeng/password';
import { map } from 'rxjs';
import { AuthFailure } from '../../core/auth/auth-failure';
import { AuthService } from '../../core/auth/auth.service';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { LanguageSwitcher } from '../../shared/language-switcher';
import { safeReturnUrl } from './return-url';

const TOTP_LENGTH = 6;

/** Why the login screen was opened by the app itself rather than by the user. */
type RedirectReason = 'notAdmin' | 'sessionExpired';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, Button, InputOtp, InputText, Message, Password, TranslatePipe, LanguageSwitcher],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly totpLength = TOTP_LENGTH;
  protected readonly step = signal<'password' | 'totp'>('password');
  protected readonly busy = signal(false);
  private readonly failure = signal<AuthFailure | null>(null);

  private readonly redirectReason = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('reason') as RedirectReason | null)),
    { initialValue: null },
  );

  /** A failure of the current attempt outranks the reason the screen was opened with. */
  protected readonly errorMessage = computed<string | null>(() => {
    const failure = this.failure();
    if (failure) {
      return this.i18n.t(`login.error.${failure.reason}`, { step: failure.step });
    }
    return this.redirectReason() === 'notAdmin' ? this.i18n.t('login.error.notAdmin') : null;
  });

  protected readonly infoMessage = computed<string | null>(() =>
    !this.failure() && this.redirectReason() === 'sessionExpired' ? this.i18n.t('login.sessionExpired') : null,
  );

  protected readonly passwordForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly totpForm = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(`\\d{${TOTP_LENGTH}}`)],
    }),
  });

  protected async submitPassword(): Promise<void> {
    if (this.passwordForm.invalid || this.busy()) {
      return;
    }

    const { email, password } = this.passwordForm.getRawValue();
    await this.attempt(async () => {
      await this.auth.signInWithPassword(email.trim(), password);
      this.step.set('totp');
    });
  }

  protected async submitTotp(): Promise<void> {
    if (this.totpForm.invalid || this.busy()) {
      return;
    }

    await this.attempt(async () => {
      await this.auth.confirmTotp(this.totpForm.controls.code.value);
      await this.router.navigateByUrl(safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    });
  }

  protected backToPassword(): void {
    this.failure.set(null);
    this.totpForm.reset();
    this.passwordForm.controls.password.reset();
    this.step.set('password');
  }

  private async attempt(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.failure.set(null);
    try {
      await action();
    } catch (error) {
      const failure = error instanceof AuthFailure ? error : new AuthFailure('generic');
      this.failure.set(failure);
      this.totpForm.reset();
      // A wrong code can be retried on the spot; every other TOTP failure ended the challenge (or
      // the session), so the only way forward is the password again.
      if (this.step() === 'totp' && failure.reason !== 'totpInvalid') {
        this.passwordForm.controls.password.reset();
        this.step.set('password');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
