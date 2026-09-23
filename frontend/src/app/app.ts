import { Component, HostListener, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CartService } from './core/cart.service';
import { CartDrawerService } from './core/cart-drawer.service';
import { Checkout } from './features/checkout/checkout';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, Checkout],
  templateUrl: './app.html',
})
export class App {
  readonly cart = inject(CartService);
  readonly drawer = inject(CartDrawerService);

  @HostListener('document:keydown.escape')
  closeDrawer(): void { this.drawer.close(); }
}
