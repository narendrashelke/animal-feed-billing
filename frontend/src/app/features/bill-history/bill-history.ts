import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink, ActivatedRoute } from '@angular/router';

/* =========================================================
   BILL INTERFACE
========================================================= */

interface Bill {
  id: number;

  invoice_number?: string;
  invoice_no?: string;
  invoice_date?: string;

  customer_id?: number;
  customer_name?: string;
  customer_code?: string;

  customer_mobile?: string;
  customer_phone?: string;
  customer_email?: string;

  customer_address?: string;
  customer_city?: string;
  customer_state?: string;
  customer_pincode?: string;
  customer_gstin?: string;

  transport_mode?: string;
  place_of_supply?: string;

  external_doc_no?: string;
  dc_no?: string;

  subtotal?: number;
  discount?: number;

  cgst?: number;
  sgst?: number;
  igst?: number;
  total_tax?: number;
  gst_total?: number;

  total_amount?: number;
  grand_total?: number;

  paid_amount?: number;
  due_amount?: number;
  payment_status?: string;

  payment_mode?: string;

  created_at?: string;

  items?: BillItem[];
}

/* =========================================================
   BILL ITEM INTERFACE
========================================================= */

interface BillItem {
  id?: number;
  product_id?: number;

  product_code?: string;

  description?: string;
  name?: string;

  hsn_code?: string;
  uom?: string;

  quantity: number;
  rate: number;

  discount?: number;

  taxable_amount?: number;

  cgst_rate?: number;
  cgst_amount?: number;

  sgst_rate?: number;
  sgst_amount?: number;

  igst_rate?: number;
  igst_amount?: number;

  gst_rate?: number;
  gst_amount?: number;

  amount?: number;
}

/* =========================================================
   BUSINESS SETTINGS
========================================================= */

interface BusinessSettings {
  ownerName: string;
  businessName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstin: string;
  phone: string;
  email: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
}

/* =========================================================
   COMPONENT
========================================================= */

@Component({
  selector: 'app-bill-history',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './bill-history.html',
  styleUrl: './bill-history.css'
})
export class BillHistory implements OnInit {

  /* =======================================================
     API
  ======================================================= */

  private readonly apiUrl = 'http://localhost:5000/api';

  /* =======================================================
     BILL DATA
  ======================================================= */

  bills: Bill[] = [];
  filteredBills: Bill[] = [];

  /* =======================================================
     SELECTED BILL
  ======================================================= */

  selectedBill: Bill | null = null;

  /* =======================================================
     SEARCH
  ======================================================= */

  searchText = '';

  /* =======================================================
     UI STATE
  ======================================================= */

  loading = false;
  showInvoice = false;

  /* =======================================================
     MESSAGES
  ======================================================= */

  message = '';
  errorMessage = '';

  /* =======================================================
     BUSINESS SETTINGS
  ======================================================= */

  businessSettings: BusinessSettings = {
    ownerName: '(Formerly known as Milklane Dairy Services Private Limited)',
    businessName: 'INNOTERRA PRIVATE LIMITED',
    address: 'Branch Office: Gat No. 1294/2/b/2/a/2, Laxmi Dahiwadi Mangalwedha (Taluka), Solapur',
    city: 'Solapur',
    state: 'Maharashtra',
    pincode: '413305',
    gstin: '27AAJCM9815D1ZA',
    phone: '',
    email: '',
    bankName: 'AXIS BANK',
    accountNumber: '926020019924761',
    ifscCode: 'UTIB0002097'
  };

  /* =======================================================
     CONSTRUCTOR
  ======================================================= */

  constructor(
    private http: HttpClient,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  /* =======================================================
     INITIALIZATION
  ======================================================= */

  ngOnInit(): void {
    this.loadBusinessSettings();
    this.loadBills();
  }

  /* =======================================================
     LOAD BUSINESS SETTINGS
  ======================================================= */

  loadBusinessSettings(): void {
    try {
      const saved = localStorage.getItem('businessSettings');

      if (!saved) {
        return;
      }

      const settings = JSON.parse(saved) as Partial<BusinessSettings>;

      this.businessSettings = {
        ...this.businessSettings,
        ...settings
      };

      if (this.businessSettings.address && this.businessSettings.address.startsWith('ranch Office:')) {
        this.businessSettings.address = 'B' + this.businessSettings.address;
      }
    } catch (error) {
      console.error('Unable to load business settings:', error);
    }
  }

  /* =======================================================
     LOAD BILLS
  ======================================================= */

  loadBills(): void {
    this.loading = true;
    this.message = '';
    this.errorMessage = '';
    this.cdr.detectChanges();

    this.http
      .get<Bill[]>(`${this.apiUrl}/bills`)
      .subscribe({
        next: (data: Bill[]) => {
          this.bills = Array.isArray(data) ? data : [];

          /* Show newest bills first. */
          this.bills.sort((a, b) => {
            const dateA = new Date(
              a.invoice_date || a.created_at || ''
            ).getTime();

            const dateB = new Date(
              b.invoice_date || b.created_at || ''
            ).getTime();

            if (
              Number.isFinite(dateA) &&
              Number.isFinite(dateB)
            ) {
              return dateB - dateA;
            }

            return b.id - a.id;
          });

          this.filteredBills = [...this.bills];
          this.loading = false;
          if (this.searchText.trim()) {
            this.searchBills();
          }
          this.checkQueryParams();
          this.cdr.detectChanges();
        },

        error: (error) => {
          console.error('Error loading bills:', error);

          this.bills = [];
          this.filteredBills = [];
          this.loading = false;

          this.errorMessage =
            error?.error?.message ||
            'Unable to load bills. Make sure the backend is running.';
          this.cdr.detectChanges();
        }
      });
  }

  private isQueryParamsSubscribed = false;

  private checkQueryParams(): void {
    if (!this.isQueryParamsSubscribed) {
      this.isQueryParamsSubscribed = true;
      this.route.queryParams.subscribe((params) => {
        if (params['id']) {
          const billId = Number(params['id']);
          const bill = this.bills.find((b) => b.id === billId);
          if (bill) {
            this.viewBill(bill);
          }
        } else if (params['search']) {
          this.searchText = params['search'];
          this.searchBills();
        }
        this.cdr.detectChanges();
      });
    } else {
      const params = this.route.snapshot.queryParams;
      if (params['id']) {
        const billId = Number(params['id']);
        const bill = this.bills.find((b) => b.id === billId);
        if (bill) {
          this.viewBill(bill);
        }
      } else if (params['search']) {
        this.searchText = params['search'];
        this.searchBills();
      }
    }
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  refreshBills(): void {
    this.searchText = '';
    this.selectedBill = null;
    this.showInvoice = false;

    this.loadBills();
  }

  /* =======================================================
     SEARCH BILLS
  ======================================================= */

  searchBills(): void {
    const search = this.searchText.trim().toLowerCase();

    if (!search) {
      this.filteredBills = [...this.bills];
      this.cdr.detectChanges();
      return;
    }

    this.filteredBills = this.bills.filter((bill: Bill) => {
      const invoice = this.getInvoiceNumber(bill).toLowerCase();

      const customer = String(
        bill.customer_name || ''
      ).toLowerCase();

      const code = String(
        bill.customer_code || ''
      ).toLowerCase();

      const mobile = String(
        bill.customer_mobile ||
        bill.customer_phone ||
        ''
      ).toLowerCase();

      const date = this.formatDate(
        bill.invoice_date
      ).toLowerCase();

      const status = this.getPaymentStatus(
        bill
      ).toLowerCase();

      const paymentMode = String(
        bill.payment_mode || ''
      ).toLowerCase();

      return (
        invoice.includes(search) ||
        customer.includes(search) ||
        code.includes(search) ||
        mobile.includes(search) ||
        date.includes(search) ||
        status.includes(search) ||
        paymentMode.includes(search)
      );
    });
    this.cdr.detectChanges();
  }

  /* =======================================================
     CLEAR SEARCH
  ======================================================= */

  clearSearch(): void {
    this.searchText = '';
    this.filteredBills = [...this.bills];
    this.cdr.detectChanges();
  }

  /* =======================================================
     VIEW BILL
  ======================================================= */

  viewBill(bill: Bill): void {
    if (!bill || !bill.id) {
      this.errorMessage = 'Invalid bill selected.';
      return;
    }

    this.loading = true;
    this.message = '';
    this.errorMessage = '';

    this.http
      .get<Bill>(`${this.apiUrl}/bills/${bill.id}`)
      .subscribe({
        next: (data: Bill) => {
          this.selectedBill = this.normalizeBillResponse(data);

          this.showInvoice = true;
          this.loading = false;
          this.cdr.detectChanges();
        },

        error: (error) => {
          console.error('Error loading bill:', error);

          this.loading = false;

          this.errorMessage =
            error?.error?.message ||
            'Unable to load this bill.';
          this.cdr.detectChanges();
        }
      });
  }

  /* =======================================================
     CLOSE INVOICE
  ======================================================= */

  closeInvoice(): void {
    this.showInvoice = false;
    this.selectedBill = null;
    this.cdr.detectChanges();
  }

  /* =======================================================
     PRINT BILL
  ======================================================= */

  printBill(bill: Bill): void {
    if (!bill || !bill.id) {
      this.errorMessage = 'Invalid bill selected.';
      return;
    }

    this.message = '';
    this.errorMessage = '';

    this.http
      .get<Bill>(`${this.apiUrl}/bills/${bill.id}`)
      .subscribe({
        next: (data: Bill) => {
          this.selectedBill = this.normalizeBillResponse(data);

          this.showInvoice = true;
          this.cdr.detectChanges();

          /*
            Wait for Angular to render the invoice
            before opening the print dialog.
          */
          setTimeout(() => {
            window.print();
          }, 400);
        },

        error: (error) => {
          console.error(
            'Error preparing bill for printing:',
            error
          );

          this.errorMessage =
            error?.error?.message ||
            'Unable to print this bill.';
          this.cdr.detectChanges();
        }
      });
  }

  /* =======================================================
     PRINT SELECTED INVOICE
  ======================================================= */

  printSelectedInvoice(): void {
    if (!this.selectedBill) {
      this.errorMessage = 'Please select a bill first.';
      return;
    }

    window.print();
  }

  /* =======================================================
     DELETE BILL
  ======================================================= */

  deleteBill(bill: Bill): void {
    if (!bill || !bill.id) {
      this.errorMessage = 'Invalid bill selected.';
      return;
    }

    const invoice = this.getInvoiceNumber(bill);

    const confirmed = window.confirm(
      `Are you sure you want to delete bill ${invoice}?\n\nThe stock quantity from this bill will be restored.`
    );

    if (!confirmed) {
      return;
    }

    this.message = '';
    this.errorMessage = '';
    this.loading = true;
    this.cdr.detectChanges();

    this.http
      .delete<{ message?: string }>(
        `${this.apiUrl}/bills/${bill.id}`
      )
      .subscribe({
        next: (response) => {
          this.message =
            response?.message ||
            `Bill ${invoice} deleted successfully.`;

          this.bills = this.bills.filter(
            (item: Bill) => item.id !== bill.id
          );

          this.filteredBills = this.filteredBills.filter(
            (item: Bill) => item.id !== bill.id
          );

          if (
            this.selectedBill &&
            this.selectedBill.id === bill.id
          ) {
            this.selectedBill = null;
            this.showInvoice = false;
          }

          this.loading = false;
          this.cdr.detectChanges();
        },

        error: (error) => {
          console.error('Error deleting bill:', error);

          this.loading = false;

          this.errorMessage =
            error?.error?.message ||
            'Unable to delete this bill.';
          this.cdr.detectChanges();
        }
      });
  }

  /* =======================================================
     NORMALIZE BILL API RESPONSE
  ======================================================= */

  private normalizeBillResponse(data: any): Bill {
    const bill = data?.bill ?? data?.sale ?? data;

    return {
      ...bill,
      items: Array.isArray(bill?.items)
        ? bill.items
        : Array.isArray(data?.items)
          ? data.items
          : []
    } as Bill;
  }

  /* =======================================================
     CURRENT SALE
  ======================================================= */

  get currentSale(): Bill | null {
    return this.selectedBill;
  }

  /* =======================================================
     CURRENT GRAND TOTAL
  ======================================================= */

  get currentGrandTotal(): number {
    if (!this.currentSale) {
      return 0;
    }

    if (
      this.currentSale.grand_total !== undefined &&
      this.currentSale.grand_total !== null
    ) {
      return Number(this.currentSale.grand_total) || 0;
    }

    if (
      this.currentSale.total_amount !== undefined &&
      this.currentSale.total_amount !== null
    ) {
      return Number(this.currentSale.total_amount) || 0;
    }

    return 0;
  }

  /* =======================================================
     INVOICE NUMBER
  ======================================================= */

  getInvoiceNumber(bill: Bill): string {
    if (bill.invoice_number) {
      return bill.invoice_number;
    }

    if (bill.invoice_no) {
      return bill.invoice_no;
    }

    return `INV-${bill.id}`;
  }

  /* =======================================================
     ITEM DESCRIPTION
  ======================================================= */

  getItemDescription(item: BillItem): string {
    return (
      item.description ||
      item.name ||
      item.product_code ||
      'Product'
    );
  }

  /* =======================================================
     HSN
  ======================================================= */

  getHsn(item: BillItem): string {
    return item.hsn_code || '—';
  }

  /* =======================================================
     ITEM AMOUNT
  ======================================================= */

  getItemAmount(item: BillItem): number {
    if (item.taxable_amount !== undefined && item.taxable_amount !== null) {
      return Number(item.taxable_amount) || 0;
    }

    const quantity = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    return quantity * rate;
  }

  /* =======================================================
     TOTAL QUANTITY
  ======================================================= */

  getTotalQuantity(items: BillItem[] | undefined): number {
    if (!items || items.length === 0) {
      return 0;
    }

    return items.reduce(
      (total: number, item: BillItem) => {
        return total + (Number(item.quantity) || 0);
      },
      0
    );
  }

  /* =======================================================
     BUSINESS ADDRESS
  ======================================================= */

  getBusinessAddress(): string {
    const parts: string[] = [];

    if (this.businessSettings.address?.trim()) {
      parts.push(this.businessSettings.address.trim());
    }

    if (this.businessSettings.city?.trim()) {
      parts.push(this.businessSettings.city.trim());
    }

    return parts.join(', ');
  }

  /* =======================================================
     STATE CODE
  ======================================================= */

  getStateCode(state: string | undefined): string {
    if (!state) {
      return '27';
    }

    const normalized = state.trim().toLowerCase();

    const stateCodes: { [key: string]: string } = {
      'jammu and kashmir': '01',
      'himachal pradesh': '02',
      'punjab': '03',
      'chandigarh': '04',
      'uttarakhand': '05',
      'haryana': '06',
      'delhi': '07',
      'rajasthan': '08',
      'uttar pradesh': '09',
      'bihar': '10',
      'sikkim': '11',
      'arunachal pradesh': '12',
      'nagaland': '13',
      'manipur': '14',
      'mizoram': '15',
      'tripura': '16',
      'meghalaya': '17',
      'assam': '18',
      'west bengal': '19',
      'jharkhand': '20',
      'odisha': '21',
      'chhattisgarh': '22',
      'madhya pradesh': '23',
      'gujarat': '24',
      'daman and diu': '25',
      'dadra and nagar haveli': '26',
      'maharashtra': '27',
      'karnataka': '29',
      'goa': '30',
      'lakshadweep': '31',
      'kerala': '32',
      'tamil nadu': '33',
      'pondicherry': '34',
      'puducherry': '34',
      'andaman and nicobar islands': '35',
      'telangana': '36',
      'andhra pradesh': '37'
    };

    return stateCodes[normalized] || '27';
  }

  /* =======================================================
     PAYMENT STATUS
  ======================================================= */

  getPaymentStatus(bill: Bill): string {
    if (
      bill.payment_status &&
      bill.payment_status.trim()
    ) {
      return bill.payment_status;
    }

    const total = Number(
      bill.grand_total ??
      bill.total_amount ??
      0
    );

    const paid = Number(bill.paid_amount ?? 0);

    if (total > 0 && paid >= total) {
      return 'Paid';
    }

    if (paid > 0) {
      return 'Partial';
    }

    return 'Pending';
  }

  /* =======================================================
     PAYMENT MODE
  ======================================================= */

  getPaymentMode(bill: Bill): string {
    return bill.payment_mode?.trim() || '—';
  }

  /* =======================================================
     FORMAT CURRENCY
  ======================================================= */

  formatCurrency(value: number | undefined | null): string {
    const amount = Number(value) || 0;

    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  /* =======================================================
     FORMAT DATE
  ======================================================= */

  formatDate(value: string | undefined | null): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);

    if (isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /* =======================================================
     NUMBER TO WORDS
  ======================================================= */

  numberToWords(amount: number): string {
    const number = Math.round(Number(amount) || 0);

    if (number === 0) {
      return 'ZERO ONLY';
    }

    const words = this.convertIndianNumber(number);

    return `${words} ONLY`;
  }

  /* =======================================================
     INDIAN NUMBER CONVERSION
  ======================================================= */

  private convertIndianNumber(number: number): string {
    const ones: string[] = [
      '',
      'ONE',
      'TWO',
      'THREE',
      'FOUR',
      'FIVE',
      'SIX',
      'SEVEN',
      'EIGHT',
      'NINE',
      'TEN',
      'ELEVEN',
      'TWELVE',
      'THIRTEEN',
      'FOURTEEN',
      'FIFTEEN',
      'SIXTEEN',
      'SEVENTEEN',
      'EIGHTEEN',
      'NINETEEN'
    ];

    const tens: string[] = [
      '',
      '',
      'TWENTY',
      'THIRTY',
      'FORTY',
      'FIFTY',
      'SIXTY',
      'SEVENTY',
      'EIGHTY',
      'NINETY'
    ];

    const twoDigits = (n: number): string => {
      if (n < 20) {
        return ones[n];
      }

      return (
        tens[Math.floor(n / 10)] +
        (n % 10 ? ` ${ones[n % 10]}` : '')
      );
    };

    const threeDigits = (n: number): string => {
      if (n < 100) {
        return twoDigits(n);
      }

      return (
        `${ones[Math.floor(n / 100)]} HUNDRED` +
        (n % 100 ? ` ${twoDigits(n % 100)}` : '')
      );
    };

    let result = '';

    /* CRORE */
    if (number >= 10000000) {
      result +=
        `${this.convertIndianNumber(
          Math.floor(number / 10000000)
        )} CRORE `;

      number %= 10000000;
    }

    /* LAKH */
    if (number >= 100000) {
      result +=
        `${this.convertIndianNumber(
          Math.floor(number / 100000)
        )} LAKH `;

      number %= 100000;
    }

    /* THOUSAND */
    if (number >= 1000) {
      result +=
        `${this.convertIndianNumber(
          Math.floor(number / 1000)
        )} THOUSAND `;

      number %= 1000;
    }

    /* HUNDREDS */
    if (number > 0) {
      result += threeDigits(number);
    }

    return result.trim();
  }
}