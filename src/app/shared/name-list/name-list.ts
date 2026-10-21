import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Popover } from 'primeng/popover';

/** One name behind a count, and where it leads. */
export type NameListItem = { id: string; label: string; link: readonly unknown[] };

/** Long enough to cross the gap between the count and its list without the list closing. */
const LEAVE_DELAY_MS = 250;

/**
 * A count that names what it counts: hovering it lists the names, each a link to its own card. A
 * press opens the same list and moves focus into it, so the keyboard reaches the links too; Escape
 * or a click elsewhere closes it. Nothing to name, and the count is plain text.
 *
 * The list is a `p-popover` appended to the page, not to the cell: the tables scroll sideways, and
 * anything positioned inside them is cut off at the last row.
 */
@Component({
  selector: 'app-name-list',
  imports: [Popover, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (items().length > 0) {
      <button
        type="button"
        class="cursor-pointer underline decoration-dotted underline-offset-4"
        aria-haspopup="dialog"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="label() + ': ' + count()"
        [attr.data-testid]="testId() + '-trigger'"
        (mouseenter)="hover($event)"
        (mouseleave)="leave()"
        (click)="press($event)"
      >
        {{ count() }}
      </button>
      <p-popover
        styleClass="name-list-popover"
        [ariaLabel]="label()"
        [focusOnShow]="false"
        (onShow)="shown()"
        (onHide)="open.set(false)"
      >
        <ul
          #list
          class="max-h-72 min-w-48 overflow-y-auto px-3 py-2"
          [attr.data-testid]="testId() + '-list'"
          (mouseenter)="stay()"
          (mouseleave)="leave()"
        >
          @for (item of items(); track item.id) {
            <li class="py-1">
              <a class="hover:underline" [routerLink]="item.link" (click)="close()">{{
                item.label
              }}</a>
            </li>
          }
        </ul>
      </p-popover>
    } @else {
      {{ count() }}
    }
  `,
})
export class NameList {
  readonly count = input.required<number>();
  readonly items = input.required<readonly NameListItem[]>();
  /** What the names are, for a screen reader: «Майстри з Копією». */
  readonly label = input.required<string>();
  readonly testId = input.required<string>();

  protected readonly open = signal(false);
  private readonly popover = viewChild(Popover);
  private readonly list = viewChild<ElementRef<HTMLElement>>('list');
  private leaving: ReturnType<typeof setTimeout> | undefined;
  /** Opened by a press rather than a hover: the list takes focus once it is on screen. */
  private focusWhenShown = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stay());
  }

  /** Hovering shows the list but leaves focus where it is. */
  protected hover(event: MouseEvent): void {
    this.stay();
    if (!this.open()) {
      this.focusWhenShown = false;
      this.popover()?.show(event);
    }
  }

  /** A press keeps a hovered list open rather than toggling it shut, and takes focus into it. */
  protected press(event: MouseEvent): void {
    this.stay();
    if (this.open()) {
      this.focusFirst();
    } else {
      this.focusWhenShown = true;
      this.popover()?.show(event);
    }
  }

  protected shown(): void {
    this.open.set(true);
    if (this.focusWhenShown) {
      this.focusFirst();
    }
  }

  protected leave(): void {
    this.stay();
    this.leaving = setTimeout(() => this.close(), LEAVE_DELAY_MS);
  }

  protected stay(): void {
    clearTimeout(this.leaving);
    this.leaving = undefined;
  }

  protected close(): void {
    this.stay();
    this.popover()?.hide();
  }

  private focusFirst(): void {
    this.list()?.nativeElement.querySelector('a')?.focus();
  }
}
