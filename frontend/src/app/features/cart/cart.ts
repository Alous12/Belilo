import { CurrencyPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartService } from '../../core/cart.service';
import { primaryImage, Product } from '../../core/models';

@Component({
  selector: 'app-cart',
  imports: [CurrencyPipe, RouterLink],
  templateUrl: './cart.html',
})
export class Cart {
  readonly cart = inject(CartService);
  readonly primaryImage = primaryImage;
  change(id: Product['id'], event: Event): void {
    this.cart.setQuantity(id, Number((event.target as HTMLInputElement).value));
  }
}
