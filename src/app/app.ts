import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block h-full' },
  template: `
    <p-toast
      position="top-right"
      data-testid="toast"
      [pt]="{ closeButton: { autofocus: false } }"
    />
    <router-outlet />
  `,
})
export class App {}
