
import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

interface Customer {
  id: number;
  customer_code?: string;
  name?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  gstin?: string;
}

interface Product {
  id: number;
  product_code?: string;
  code?: string;
  name?: string;
  product_name?: string;
  stock_quantity?: number;
  stock?: number;
  minimum_stock?: number;
  min_stock?: number;
  selling_price?: number;
}

interface Sale {
  id: number;
  invoice_no?: string;
  invoice_number?: string;
  invoice_date?: string;
  customer_id?: number;
  customer_code?: string;
  customer_name?: string;
  subtotal?: number;
  discount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total_tax?: number;
  total_amount?: number;
  grand_total?: number;
  paid_amount?: number;
  due_amount?: number;
  payment_status?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit {
  private readonly apiUrl = 'http://localhost:5000/api';

  currentDate = '';
  currentYear = new Date().getFullYear();

  loading = true;
  errorMessage = '';

  customers: Customer[] = [];
  products: Product[] = [];
  sales: Sale[] = [];

  totalCustomers = 0;
  totalProducts = 0;

  todaySales = 0;
  todayBillCount = 0;
  totalDue = 0;
  lowStockCount = 0;

  recentSales: Sale[] = [];

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    this.currentDate = new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    console.log('Dashboard: starting data loading...');

    this.loading = true;
    this.errorMessage = '';

    this.customers = [];
    this.products = [];
    this.sales = [];

    this.totalCustomers = 0;
    this.totalProducts = 0;
    this.todaySales = 0;
    this.todayBillCount = 0;
    this.totalDue = 0;
    this.lowStockCount = 0;
    this.recentSales = [];

    forkJoin({
      customers: this.http
        .get<Customer[]>(`${this.apiUrl}/customers`)
        .pipe(
          catchError((error) => {
            console.error('Dashboard Customers Error:', error);
            this.errorMessage = 'Unable to load customer information.';
            return of([] as Customer[]);
          })
        ),

      products: this.http
        .get<Product[]>(`${this.apiUrl}/products`)
        .pipe(
          catchError((error) => {
            console.error('Dashboard Products Error:', error);
            this.errorMessage = 'Unable to load product information.';
            return of([] as Product[]);
          })
        ),

      sales: this.http
        .get<Sale[]>(`${this.apiUrl}/sales`)
        .pipe(
          catchError((error) => {
            console.error('Dashboard Sales Error:', error);
            this.errorMessage = 'Unable to load sales information.';
            return of([] as Sale[]);
          })
        )
    })
      .pipe(
        finalize(() => {
          this.loading = false;

          console.log('Dashboard: all data requests finished.');

          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Dashboard Customers:', response.customers);
          console.log('Dashboard Products:', response.products);
          console.log('Dashboard Sales:', response.sales);

          this.customers = Array.isArray(response.customers)
            ? response.customers
            : [];

          this.products = Array.isArray(response.products)
            ? response.products
            : [];

          this.sales = Array.isArray(response.sales)
            ? response.sales
            : [];

          this.totalCustomers = this.customers.length;
          this.totalProducts = this.products.length;

          this.calculateLowStock();
          this.calculateSalesStatistics();
        },

        error: (error) => {
          console.error('Dashboard loading error:', error);
          this.errorMessage = 'An unexpected error occurred while loading the dashboard.';
        }
      });
  }

  private calculateLowStock(): void {
    this.lowStockCount = this.products.filter((product) => {
      return this.getStock(product) <= this.getMinimumStock(product);
    }).length;
  }

  private getStock(product: Product): number {
    if (product.stock_quantity !== undefined && product.stock_quantity !== null) {
      return Number(product.stock_quantity) || 0;
    }

    if (product.stock !== undefined && product.stock !== null) {
      return Number(product.stock) || 0;
    }

    return 0;
  }

  private getMinimumStock(product: Product): number {
    if (product.minimum_stock !== undefined && product.minimum_stock !== null) {
      return Number(product.minimum_stock) || 0;
    }

    if (product.min_stock !== undefined && product.min_stock !== null) {
      return Number(product.min_stock) || 0;
    }

    return 10;
  }

  private calculateSalesStatistics(): void {
    this.todaySales = 0;
    this.todayBillCount = 0;
    this.totalDue = 0;

    this.sales.forEach((sale) => {
      const amount = this.getSaleTotal(sale);
      const due = this.getDueAmount(sale);

      this.totalDue += due;

      if (this.isToday(sale.invoice_date)) {
        this.todaySales += amount;
        this.todayBillCount++;
      }
    });

    this.recentSales = [...this.sales]
      .sort((a, b) => {
        return (
          this.parseInvoiceDate(b.invoice_date).getTime() -
          this.parseInvoiceDate(a.invoice_date).getTime()
        );
      })
      .slice(0, 5);
  }

  private parseInvoiceDate(dateValue?: string): Date {
    if (!dateValue) {
      return new Date(0);
    }

    const value = String(dateValue).trim();

    const indianDate = value.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

    if (indianDate) {
      return new Date(
        Number(indianDate[3]),
        Number(indianDate[2]) - 1,
        Number(indianDate[1])
      );
    }

    const isoDate = value.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

    if (isoDate) {
      return new Date(
        Number(isoDate[1]),
        Number(isoDate[2]) - 1,
        Number(isoDate[3])
      );
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  private isToday(dateValue?: string): boolean {
    if (!dateValue) {
      return false;
    }

    const date = this.parseInvoiceDate(dateValue);

    if (date.getTime() === 0 || Number.isNaN(date.getTime())) {
      return false;
    }

    const today = new Date();

    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  }

  getSaleTotal(sale: Sale): number {
    if (sale.total_amount !== undefined && sale.total_amount !== null) {
      return Number(sale.total_amount) || 0;
    }

    if (sale.grand_total !== undefined && sale.grand_total !== null) {
      return Number(sale.grand_total) || 0;
    }

    return 0;
  }

  getDueAmount(sale: Sale): number {
    if (sale.due_amount !== undefined && sale.due_amount !== null) {
      return Math.max(0, Number(sale.due_amount) || 0);
    }

    const total = this.getSaleTotal(sale);
    const paid = Number(sale.paid_amount) || 0;

    return Math.max(0, total - paid);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(Number(value) || 0);
  }

  formatDate(dateValue?: string): string {
    if (!dateValue) {
      return '-';
    }

    const date = this.parseInvoiceDate(dateValue);

    if (date.getTime() === 0 || Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  getInvoiceNumber(sale: Sale): string {
    return sale.invoice_no || sale.invoice_number || `INV-${sale.id}`;
  }

  getCustomerName(sale: Sale): string {
    if (sale.customer_name) {
      return sale.customer_name;
    }

    if (sale.customer_code) {
      const customer = this.customers.find(
        (item) => item.customer_code === sale.customer_code
      );

      if (customer?.name) {
        return customer.name;
      }
    }

    if (sale.customer_id) {
      const customer = this.customers.find(
        (item) => item.id === sale.customer_id
      );

      if (customer?.name) {
        return customer.name;
      }
    }

    return 'Walk-in Customer';
  }

  getPaymentStatus(sale: Sale): string {
    if (sale.payment_status) {
      const status = sale.payment_status.toString().toUpperCase();

      if (status === 'PAID') {
        return 'Paid';
      }

      if (status === 'PARTIAL') {
        return 'Partial';
      }

      if (status === 'UNPAID' || status === 'PENDING') {
        return 'Pending';
      }
    }

    const total = this.getSaleTotal(sale);
    const due = this.getDueAmount(sale);
    const paid = sale.paid_amount !== undefined && sale.paid_amount !== null
      ? Number(sale.paid_amount) || 0
      : (total - due);

    if (total <= 0 || due <= 0.01 || paid >= total) {
      return 'Paid';
    }

    if (paid > 0 && due > 0) {
      return 'Partial';
    }

    return 'Pending';
  }

  refreshDashboard(): void {
    this.loadDashboardData();
  }
}