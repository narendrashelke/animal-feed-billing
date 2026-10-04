import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute } from '@angular/router';

export interface PendingBill {
  id: number;
  invoice_no: string;
  invoice_date: string;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  payment_status: string;
}

export interface CustomerSummary {
  customer_id: number;
  customer_code: string;
  name: string;
  mobile: string;
  village: string;
  taluka: string;
  district: string;
  total_billed: number;
  total_paid: number;
  total_due: number;
  pending_bills: PendingBill[];
}

export interface PaymentRecord {
  id: number;
  sale_id?: number;
  customer_id: number;
  customer_code: string;
  customer_name: string;
  customer_mobile?: string;
  invoice_no?: string;
  payment_date: string;
  amount: number;
  payment_mode: string;
  reference_no?: string;
  notes?: string;
  created_at: string;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payments.html',
  styleUrl: './payments.css'
})
export class Payments implements OnInit {

  private readonly apiUrl = 'http://localhost:5000/api';

  activeTab: 'dues' | 'history' = 'dues';

  customersSummary: CustomerSummary[] = [];
  filteredCustomers: CustomerSummary[] = [];
  paymentsHistory: PaymentRecord[] = [];
  filteredHistory: PaymentRecord[] = [];

  searchText = '';
  historySearchText = '';
  loading = false;
  message = '';
  errorMessage = '';

  // RECORD PAYMENT FORM MODAL
  showPaymentModal = false;
  savingPayment = false;

  paymentForm = {
    customer_id: null as number | null,
    sale_id: null as number | null,
    payment_date: new Date().toISOString().slice(0, 10),
    amount: null as number | null,
    payment_mode: 'Cash',
    reference_no: '',
    notes: ''
  };

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadCustomersSummary();
    this.loadPaymentsHistory();
    this.checkQueryParams();
  }

  private checkQueryParams(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['customer_id']) {
        const custId = Number(params['customer_id']);
        if (custId) {
          setTimeout(() => {
            const found = this.customersSummary.find(c => c.customer_id === custId);
            if (found) {
              this.openPaymentModal(found);
            }
          }, 300);
        }
      }
    });
  }

  loadCustomersSummary(): void {
    this.loading = true;
    this.http.get<CustomerSummary[]>(`${this.apiUrl}/payments/customers-summary`)
      .subscribe({
        next: (data) => {
          this.customersSummary = Array.isArray(data) ? data : [];
          this.filterCustomers();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading payments summary:', err);
          this.errorMessage = err?.error?.error || 'Failed to load customer dues.';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  loadPaymentsHistory(): void {
    this.http.get<PaymentRecord[]>(`${this.apiUrl}/payments`)
      .subscribe({
        next: (data) => {
          this.paymentsHistory = Array.isArray(data) ? data : [];
          this.filterHistory();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error loading payments history:', err);
        }
      });
  }

  filterCustomers(): void {
    const search = this.searchText.trim().toLowerCase();
    if (!search) {
      this.filteredCustomers = [...this.customersSummary];
      return;
    }
    this.filteredCustomers = this.customersSummary.filter(c =>
      String(c.customer_code || '').toLowerCase().includes(search) ||
      String(c.name || '').toLowerCase().includes(search) ||
      String(c.village || '').toLowerCase().includes(search) ||
      String(c.mobile || '').toLowerCase().includes(search)
    );
  }

  filterHistory(): void {
    const search = this.historySearchText.trim().toLowerCase();
    if (!search) {
      this.filteredHistory = [...this.paymentsHistory];
      return;
    }
    this.filteredHistory = this.paymentsHistory.filter(p =>
      String(p.customer_name || '').toLowerCase().includes(search) ||
      String(p.customer_code || '').toLowerCase().includes(search) ||
      String(p.invoice_no || '').toLowerCase().includes(search) ||
      String(p.payment_mode || '').toLowerCase().includes(search) ||
      String(p.reference_no || '').toLowerCase().includes(search)
    );
  }

  get totalOutstandingDue(): number {
    return this.customersSummary.reduce((sum, c) => sum + Number(c.total_due || 0), 0);
  }

  get totalBilledAmount(): number {
    return this.customersSummary.reduce((sum, c) => sum + Number(c.total_billed || 0), 0);
  }

  get totalPaidAmount(): number {
    return this.customersSummary.reduce((sum, c) => sum + Number(c.total_paid || 0), 0);
  }

  get selectedCustomer(): CustomerSummary | null {
    if (!this.paymentForm.customer_id) return null;
    return this.customersSummary.find(c => c.customer_id === Number(this.paymentForm.customer_id)) || null;
  }

  get availablePendingBills(): PendingBill[] {
    const cust = this.selectedCustomer;
    return cust ? cust.pending_bills || [] : [];
  }

  openPaymentModal(customer?: CustomerSummary, billId?: number): void {
    this.message = '';
    this.errorMessage = '';
    this.paymentForm = {
      customer_id: customer ? customer.customer_id : (this.customersSummary[0]?.customer_id || null),
      sale_id: billId || null,
      payment_date: new Date().toISOString().slice(0, 10),
      amount: null,
      payment_mode: 'Cash',
      reference_no: '',
      notes: ''
    };

    if (billId && customer) {
      const bill = customer.pending_bills?.find(b => b.id === billId);
      if (bill) {
        this.paymentForm.amount = bill.due_amount;
      }
    } else if (customer && customer.total_due > 0) {
      this.paymentForm.amount = customer.total_due;
    }

    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
  }

  onCustomerChange(): void {
    this.paymentForm.sale_id = null;
    const cust = this.selectedCustomer;
    if (cust && cust.total_due > 0) {
      this.paymentForm.amount = cust.total_due;
    } else {
      this.paymentForm.amount = null;
    }
  }

  onBillChange(): void {
    if (this.paymentForm.sale_id) {
      const bill = this.availablePendingBills.find(b => b.id === Number(this.paymentForm.sale_id));
      if (bill) {
        this.paymentForm.amount = bill.due_amount;
      }
    } else {
      const cust = this.selectedCustomer;
      if (cust) {
        this.paymentForm.amount = cust.total_due;
      }
    }
  }

  submitPayment(): void {
    if (!this.paymentForm.customer_id) {
      alert('Please select a customer.');
      return;
    }

    const amt = Number(this.paymentForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert('Please enter a valid payment amount greater than zero.');
      return;
    }

    this.savingPayment = true;

    const payload = {
      customer_id: Number(this.paymentForm.customer_id),
      sale_id: this.paymentForm.sale_id ? Number(this.paymentForm.sale_id) : null,
      payment_date: this.paymentForm.payment_date,
      amount: amt,
      payment_mode: this.paymentForm.payment_mode,
      reference_no: this.paymentForm.reference_no,
      notes: this.paymentForm.notes
    };

    this.http.post<any>(`${this.apiUrl}/payments`, payload).subscribe({
      next: (res) => {
        this.message = res?.message || 'Payment recorded successfully!';
        this.savingPayment = false;
        this.closePaymentModal();
        this.loadCustomersSummary();
        this.loadPaymentsHistory();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error submitting payment:', err);
        alert(err?.error?.error || 'Failed to record payment.');
        this.savingPayment = false;
        this.cdr.detectChanges();
      }
    });
  }

  // STATEMENT MODAL
  showStatementModal = false;
  loadingStatement = false;
  statementData: {
    customer: any;
    summary: {
      total_billed: number;
      total_paid: number;
      current_balance: number;
    };
    ledger_entries: Array<{
      id: string;
      date: string;
      type: string;
      reference_no: string;
      description: string;
      debit: number;
      credit: number;
      running_balance: number;
    }>;
  } | null = null;

  businessSettings = {
    businessName: 'Shree Ganesh PashuKhadya Kendra',
    ownerName: 'Narendra Shelke',
    address: 'At Post Umbare, Taluka Rahuri',
    city: 'Umbare',
    state: 'Maharashtra',
    pincode: '414105',
    gstin: '27ABCDE1234F1ZH',
    phone: '9700900933'
  };

  openStatementModal(customerId: number): void {
    this.loadingStatement = true;
    this.showStatementModal = true;
    this.statementData = null;

    const saved = localStorage.getItem('businessSettings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.businessSettings = { ...this.businessSettings, ...parsed };
      } catch (e) {}
    }

    this.http.get<any>(`${this.apiUrl}/payments/statement/${customerId}`).subscribe({
      next: (data) => {
        this.statementData = data;
        this.loadingStatement = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error fetching statement:', err);
        alert('Failed to load customer statement.');
        this.loadingStatement = false;
        this.showStatementModal = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeStatementModal(): void {
    this.showStatementModal = false;
    this.statementData = null;
  }

  printStatement(): void {
    window.print();
  }

  formatCurrency(value: number | undefined | null): string {
    const val = Number(value) || 0;
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}
