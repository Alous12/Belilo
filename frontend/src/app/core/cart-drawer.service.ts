import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartDrawerService {
  readonly isOpen = signal(false);
  readonly step = signal<'selection' | 'details'>('selection');
  open(step: 'selection' | 'details' = 'selection'): void {
    this.step.set(step);
    this.isOpen.set(true);
  }
  showDetails(): void { this.step.set('details'); }
  showSelection(): void { this.step.set('selection'); }
  close(): void {
    this.isOpen.set(false);
    this.step.set('selection');
  }
}
