import { Component, computed, input, output, signal } from '@angular/core';
import { Product, productImages } from '../core/models';
import { ArrowIcon } from './arrow-icon';

@Component({
  selector: 'app-product-gallery',
  imports: [ArrowIcon],
  template: `
    <div class="product-gallery" [class.large]="large()">
      @if (activeImage(); as image) {
        @if (large()) { <img class="gallery-photo" [src]="image" [alt]="product().name + ', foto ' + (activeIndex() + 1)"> }
        @else { <button type="button" class="gallery-photo-button" (click)="view.emit()" [attr.aria-label]="'Ver detalles de ' + product().name"><img class="gallery-photo" [src]="image" [alt]="product().name + ', foto ' + (activeIndex() + 1)"><span class="image-hint">Ver detalles <app-arrow-icon direction="up-right" /></span></button> }
      } @else { <span class="gallery-empty" aria-label="Sin imagen">✦</span> }
      @if (images().length > 1) {
        <button type="button" class="gallery-arrow previous" (click)="move(-1)" [attr.aria-label]="'Foto anterior de ' + product().name"><app-arrow-icon direction="chevron-left" /></button>
        <button type="button" class="gallery-arrow next" (click)="move(1)" [attr.aria-label]="'Foto siguiente de ' + product().name"><app-arrow-icon direction="chevron-right" /></button>
        <div class="gallery-dots" [attr.aria-label]="'Fotos de ' + product().name">@for (image of images(); track image; let position = $index) { <button type="button" class="gallery-dot" [class.active]="activeIndex() === position" (click)="index.set(position)" [attr.aria-label]="'Mostrar foto ' + (position + 1)" [attr.aria-pressed]="activeIndex() === position"></button> }</div>
      }
    </div>
  `,
})
export class ProductGallery {
  readonly product = input.required<Product>();
  readonly large = input(false);
  readonly view = output<void>();
  readonly index = signal(0);
  readonly images = computed(() => productImages(this.product()));
  readonly activeIndex = computed(() => this.images().length ? this.index() % this.images().length : 0);
  readonly activeImage = computed(() => this.images()[this.activeIndex()] ?? '');

  move(direction: number): void {
    const count = this.images().length;
    if (count > 1) this.index.set((this.activeIndex() + direction + count) % count);
  }
}
