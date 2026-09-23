import { Component, HostListener, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CartService } from './core/cart.service';
import { CartDrawerService } from './core/cart-drawer.service';
import { Checkout } from './features/checkout/checkout';
import { AdminEntryService } from './core/admin-entry.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Checkout],
  templateUrl: './app.html',
})
export class App {
  readonly cart = inject(CartService);
  readonly drawer = inject(CartDrawerService);
  private readonly router = inject(Router);
  private readonly adminEntry = inject(AdminEntryService);
  private brandClicks = 0;
  private lastBrandClick = 0;

  onBrandClick(): void {
    const now = Date.now();
    this.brandClicks = now - this.lastBrandClick <= 1800 ? this.brandClicks + 1 : 1;
    this.lastBrandClick = now;
    if (this.brandClicks === 4) {
      this.brandClicks = 0;
      this.drawer.close();
      this.adminEntry.grant();
      void this.router.navigateByUrl('/admin');
      return;
    }
    void this.router.navigateByUrl('/inicio');
  }

  @HostListener('document:keydown.escape')
  closeDrawer(): void { this.drawer.close(); }
}
