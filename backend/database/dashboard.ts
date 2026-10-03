import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {

  constructor(private router: Router) {}

  goToSales(): void {
    this.router.navigate(['/sales']);
  }

  goToCustomers(): void {
    this.router.navigate(['/customers']);
  }

  goToProducts(): void {
    this.router.navigate(['/products']);
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }
}