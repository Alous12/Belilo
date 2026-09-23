import { Component, input } from '@angular/core';

@Component({
  selector: 'app-arrow-icon',
  host: { 'aria-hidden': 'true' },
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      @switch (direction()) {
        @case ('up-right') { <path d="M5 19 19 5M9 5h10v10" /> }
        @case ('left') { <path d="M20 12H4m7-7-7 7 7 7" /> }
        @case ('chevron-left') { <path d="m15 18-6-6 6-6" /> }
        @case ('chevron-right') { <path d="m9 18 6-6-6-6" /> }
        @default { <path d="M4 12h16m-7-7 7 7-7 7" /> }
      }
    </svg>
  `,
})
export class ArrowIcon {
  readonly direction = input<'right' | 'left' | 'up-right' | 'chevron-left' | 'chevron-right'>('right');
}
