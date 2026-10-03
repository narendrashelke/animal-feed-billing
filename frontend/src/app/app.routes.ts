import { Routes } from '@angular/router';

export const routes: Routes = [

  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },

  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard')
        .then(m => m.Dashboard)
  },

  {
    path: 'customers',
    loadComponent: () =>
      import('./features/customers/customers')
        .then(m => m.Customers)
  },

  {
    path: 'products',
    loadComponent: () =>
      import('./features/products/products')
        .then(m => m.Products)
  },

  {
    path: 'sales',
    loadComponent: () =>
      import('./features/sales/sales')
        .then(m => m.Sales)
  },

  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings')
        .then(m => m.Settings)
  },

  {
    path: 'bill-history',
    loadComponent: () =>
      import('./features/bill-history/bill-history')
        .then(m => m.BillHistory)
  },

  {
    path: 'payments',
    loadComponent: () =>
      import('./features/payments/payments')
        .then(m => m.Payments)
  },

  {
    path: '**',
    redirectTo: 'dashboard'
  }

];