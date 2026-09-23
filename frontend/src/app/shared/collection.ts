import { Component, input, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export interface Identifiable { id: string | number; }

@Component({
  selector: 'app-collection',
  imports: [NgTemplateOutlet],
  template: `
    @if (items().length) {
      <div class="collection-grid">
        @for (item of items(); track item.id) {
          <ng-container [ngTemplateOutlet]="itemTemplate()" [ngTemplateOutletContext]="{ $implicit: item }" />
        }
      </div>
    } @else {
      <div class="empty-state"><strong>{{ emptyTitle() }}</strong><p>{{ emptyDescription() }}</p></div>
    }
  `,
})
export class Collection<T extends Identifiable> {
  readonly items = input.required<readonly T[]>();
  readonly itemTemplate = input.required<TemplateRef<{ $implicit: T }>>();
  readonly emptyTitle = input('No hay elementos');
  readonly emptyDescription = input('Vuelve a intentarlo más tarde.');
}
