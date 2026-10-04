import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

interface Customer {
  id: number;
  customer_code: string;
  name: string;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  village?: string | null;
  taluka?: string | null;
  district?: string | null;
  state?: string | null;
  state_code?: string | null;
  pincode?: string | null;
  gstin?: string | null;
}

interface Product {
  id: number;
  product_code: string;
  product_name: string;
  hsn_code?: string | null;
  uom?: string | null;
  weight?: number | null;
  selling_rate: number;
  gst_rate: number;
}

interface BillItem {
  product: Product;
  quantity: number;
  rate: number;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  amount: number;
}

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

@Component({
  selector: 'app-sales',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './sales.html',
  styleUrl: './sales.css'
})
export class Sales implements OnInit {

  private readonly API_URL = 'http://localhost:5000/api';

  customers: Customer[] = [];
  products: Product[] = [];
  billItems: BillItem[] = [];

  selectedCustomerId: number | null = null;
  selectedProductId: number | null = null;

  quantity = 1;

  invoiceNumber = '';
  invoiceDate = '';

  externalDocNo = '';
  transportMode = 'By Road';
  placeOfSupply = 'Maharashtra';
  dcNo = '';

  message = '';
  isSaving = false;

  subtotal = 0;
  gstTotal = 0;
  grandTotal = 0;
  totalQuantity = 0;

  // Payment details
  paidAmount = 0;
  dueAmount = 0;
  paymentStatus = 'Pending';
  paymentMode = 'Cash';

  business: BusinessSettings = {
    ownerName: 'Narendra Shelke',
    businessName: 'Shree Ganesh PashuKhadya Kendra',
    address: 'At Post Umbare, Taluka Rahuri',
    city: 'Umbare',
    state: 'Maharashtra',
    pincode: '414105',
    gstin: '27ABCDE1234F1ZH',
    phone: '9100900933',
    email: 'ganeshfeed@gmail.com',
    bankName: 'AXIS BANK',
    accountNumber: '926020019924761',
    ifscCode: 'UTIB0002097'
  };

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.setInvoiceDetails();
    this.loadBusinessSettings();
    this.loadCustomers();
    this.loadProducts();
  }

  get isIntraState(): boolean {
    const supplyState = (this.placeOfSupply || '').trim().toLowerCase();
    const businessState = (this.business.state || 'Maharashtra').trim().toLowerCase();

    return (
      !supplyState ||
      supplyState.includes(businessState) ||
      supplyState.includes('27') ||
      businessState.includes(supplyState)
    );
  }

  get cgstTotal(): number {
    return this.isIntraState ? this.gstTotal / 2 : 0;
  }

  get sgstTotal(): number {
    return this.isIntraState ? this.gstTotal / 2 : 0;
  }

  get igstTotal(): number {
    return this.isIntraState ? 0 : this.gstTotal;
  }

  // =========================================================
  // INVOICE DETAILS
  // =========================================================

  private setInvoiceDetails(): void {
    const now = new Date();

    this.invoiceDate = this.formatDate(now);

    const timestamp = now.getTime();

    this.invoiceNumber =
      'INV-' + String(timestamp).slice(-6);
  }

  private formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}/${month}/${year}`;
  }

  // =========================================================
  // BUSINESS SETTINGS
  // =========================================================

  private loadBusinessSettings(): void {

    const saved = localStorage.getItem('businessSettings');

    if (!saved) {
      return;
    }

    try {
      const data = JSON.parse(saved);

      this.business = {
        ...this.business,
        ...data
      };

      if (this.business.address && this.business.address.startsWith('ranch Office:')) {
        this.business.address = 'B' + this.business.address;
      }

      if (this.business.state) {
        this.placeOfSupply = this.business.state;
      }

    } catch (error) {
      console.error(
        'Unable to read business settings',
        error
      );
    }
  }

  // =========================================================
  // LOAD CUSTOMERS
  // =========================================================

  loadCustomers(): void {

    this.http
      .get<Customer[]>(`${this.API_URL}/customers`)
      .subscribe({
        next: (data) => {
          this.customers = Array.isArray(data) ? data : [];
          this.cdr.detectChanges();
        },

        error: (error) => {
          console.error(
            'Customer loading failed',
            error
          );

          this.customers = [];
          this.message =
            'Unable to load customers. Please start the backend server.';
          this.cdr.detectChanges();
        }
      });
  }

  // =========================================================
  // LOAD PRODUCTS
  // =========================================================

  loadProducts(): void {

    this.http
      .get<Product[]>(`${this.API_URL}/products`)
      .subscribe({
        next: (data) => {
          this.products = Array.isArray(data) ? data : [];
          this.cdr.detectChanges();
        },

        error: (error) => {
          console.error(
            'Product loading failed',
            error
          );

          this.products = [];
          this.message =
            'Unable to load products. Please start the backend server.';
          this.cdr.detectChanges();
        }
      });
  }

  // =========================================================
  // SELECTED CUSTOMER
  // =========================================================

  get selectedCustomer(): Customer | null {

    if (this.selectedCustomerId === null) {
      return null;
    }

    return (
      this.customers.find(
        customer =>
          Number(customer.id) ===
          Number(this.selectedCustomerId)
      ) ?? null
    );
  }

  // =========================================================
  // SELECTED PRODUCT
  // =========================================================

  get selectedProduct(): Product | null {

    if (this.selectedProductId === null) {
      return null;
    }

    return (
      this.products.find(
        product =>
          Number(product.id) ===
          Number(this.selectedProductId)
      ) ?? null
    );
  }

  // =========================================================
  // ADD PRODUCT
  // =========================================================

  addProduct(): void {

    this.message = '';

    if (this.selectedProductId === null) {
      this.message = 'Please select a product.';
      return;
    }

    const product = this.selectedProduct;

    if (!product) {
      this.message = 'Selected product was not found.';
      return;
    }

    const qty = Number(this.quantity);

    if (!Number.isFinite(qty) || qty <= 0) {
      this.message =
        'Quantity must be greater than zero.';
      return;
    }

    const rate = Number(product.selling_rate) || 0;
    const gstRate = Number(product.gst_rate) || 0;

    const existingItem = this.billItems.find(
      item =>
        Number(item.product.id) ===
        Number(product.id)
    );

    if (existingItem) {

      existingItem.quantity += qty;

      this.calculateItem(existingItem);

    } else {

      const item: BillItem = {
        product,
        quantity: qty,
        rate,
        gstRate,
        taxableAmount: 0,
        gstAmount: 0,
        amount: 0
      };

      this.calculateItem(item);

      this.billItems.push(item);
    }

    this.calculateTotals();

    this.selectedProductId = null;
    this.quantity = 1;

    this.message = 'Product added successfully.';
  }

  // =========================================================
  // CALCULATE ITEM
  // =========================================================

  private calculateItem(item: BillItem): void {

    item.taxableAmount =
      item.quantity * item.rate;

    item.gstAmount =
      item.taxableAmount *
      item.gstRate /
      100;

    item.amount =
      item.taxableAmount +
      item.gstAmount;
  }

  // =========================================================
  // REMOVE ITEM
  // =========================================================

  removeItem(index: number): void {

    if (
      index < 0 ||
      index >= this.billItems.length
    ) {
      return;
    }

    this.billItems.splice(index, 1);

    this.calculateTotals();
    this.cdr.detectChanges();
  }

  updateItemQuantity(index: number, newQty: number): void {
    if (index < 0 || index >= this.billItems.length) return;
    const qty = Number(newQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    this.billItems[index].quantity = qty;
    this.calculateTotals();
    this.cdr.detectChanges();
  }

  incrementQuantity(index: number): void {
    if (index < 0 || index >= this.billItems.length) return;
    this.billItems[index].quantity += 1;
    this.calculateTotals();
    this.cdr.detectChanges();
  }

  decrementQuantity(index: number): void {
    if (index < 0 || index >= this.billItems.length) return;
    if (this.billItems[index].quantity > 1) {
      this.billItems[index].quantity -= 1;
      this.calculateTotals();
      this.cdr.detectChanges();
    }
  }

  // =========================================================
  // CALCULATE TOTALS
  // =========================================================

  calculateTotals(): void {

    this.subtotal = 0;
    this.gstTotal = 0;
    this.totalQuantity = 0;

    for (const item of this.billItems) {

      this.calculateItem(item);

      this.subtotal += item.taxableAmount;
      this.gstTotal += item.gstAmount;
      this.totalQuantity += item.quantity;
    }

    this.grandTotal =
      this.subtotal +
      this.gstTotal;

    this.calculatePayment();
  }

  // =========================================================
  // CALCULATE PAYMENT
  // =========================================================

  calculatePayment(): void {

    let paid = Number(this.paidAmount);

    if (!Number.isFinite(paid) || paid < 0) {
      paid = 0;
    }

    if (paid > this.grandTotal) {
      paid = this.grandTotal;
    }

    this.paidAmount = Number(paid.toFixed(2));

    this.dueAmount = Number(
      Math.max(0, this.grandTotal - this.paidAmount).toFixed(2)
    );

    if (this.grandTotal <= 0 || this.paidAmount <= 0) {
      this.paymentStatus = 'Pending';
    } else if (this.dueAmount <= 0) {
      this.paymentStatus = 'Paid';
    } else {
      this.paymentStatus = 'Partial';
    }
  }

  // =========================================================
  // SAVE BILL
  // =========================================================

  saveBill(andPrint = false): void {

    if (this.billItems.length === 0) {
      this.message =
        'Please add at least one product.';
      return;
    }

    if (this.selectedCustomerId === null) {
      this.message =
        'Please select a customer.';
      return;
    }

    if (this.isSaving) {
      return;
    }

    const payload = {
      invoice_number: this.invoiceNumber,
      invoice_date: this.invoiceDate,
      customer_id: this.selectedCustomerId,
      external_doc_no: this.externalDocNo,
      transport_mode: this.transportMode,
      place_of_supply: this.placeOfSupply,
      dc_no: this.dcNo,
      subtotal: this.subtotal,
      gst_total: this.gstTotal,
      grand_total: this.grandTotal,
      paid_amount: this.paidAmount,
      due_amount: this.dueAmount,
      payment_status: this.paymentStatus,
      payment_mode: this.paymentMode,

      items: this.billItems.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        rate: item.rate,
        gst_rate: item.gstRate,
        amount: item.amount
      }))
    };

    this.isSaving = true;
    this.message = 'Saving bill...';

    this.http
      .post<any>(
        `${this.API_URL}/sales`,
        payload
      )
      .subscribe({

        next: (response) => {

          this.isSaving = false;

          if (
            response &&
            response.invoice_number
          ) {
            this.invoiceNumber =
              response.invoice_number;
          }

          this.message =
            'Bill saved successfully.';
          this.cdr.detectChanges();

          if (andPrint) {
            setTimeout(() => {
              window.print();
            }, 300);
          }
        },

        error: (error) => {

          console.error(
            'Save bill error',
            error
          );

          this.isSaving = false;

          this.message =
            error?.error?.error ||
            error?.error?.message ||
            'Unable to save bill. Please check the backend API.';
          this.cdr.detectChanges();
        }
      });
  }

  // =========================================================
  // CLEAR BILL
  // =========================================================

  clearBill(): void {

    this.billItems = [];

    this.selectedCustomerId = null;
    this.selectedProductId = null;

    this.quantity = 1;

    this.externalDocNo = '';
    this.transportMode = 'By Road';
    this.placeOfSupply =
      this.business.state || 'Maharashtra';
    this.dcNo = '';

    this.paidAmount = 0;
    this.dueAmount = 0;
    this.paymentStatus = 'Pending';
    this.paymentMode = 'Cash';

    this.message = '';

    this.calculateTotals();
    this.setInvoiceDetails();
  }

  // =========================================================
  // PRINT BILL
  // =========================================================

  printBill(): void {

    if (this.billItems.length === 0) {
      this.message =
        'Please add at least one product before printing.';
      return;
    }

    window.print();
  }

  // =========================================================
  // GENERATE PDF
  // =========================================================

  generatePdf(): void {

    if (this.billItems.length === 0) {
      this.message =
        'Please add at least one product before generating PDF.';
      return;
    }

    /*
     * The browser print dialog provides:
     *
     * Printer -> Print
     * Destination -> Save as PDF
     *
     * This produces the same invoice layout
     * as the print version.
     */

    window.print();
  }

  // =========================================================
  // AMOUNT IN WORDS
  // =========================================================

  get amountInWords(): string {

    const amount =
      Math.round(this.grandTotal);

    if (amount === 0) {
      return 'ZERO RUPEES ONLY';
    }

    return (
      this.numberToWords(amount)
        .toUpperCase() +
      ' RUPEES ONLY'
    );
  }

  private numberToWords(num: number): string {

    if (num === 0) {
      return 'ZERO';
    }

    const ones = [
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

    const tens = [
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

    const convertBelowThousand =
      (n: number): string => {

        let result = '';

        if (n >= 100) {

          result +=
            ones[Math.floor(n / 100)] +
            ' HUNDRED';

          n %= 100;

          if (n > 0) {
            result += ' AND ';
          }
        }

        if (n >= 20) {

          result +=
            tens[Math.floor(n / 10)];

          n %= 10;

          if (n > 0) {
            result +=
              ' ' + ones[n];
          }

        } else if (n > 0) {

          result += ones[n];
        }

        return result;
      };

    let result = '';

    const crore =
      Math.floor(num / 10000000);

    num %= 10000000;

    const lakh =
      Math.floor(num / 100000);

    num %= 100000;

    const thousand =
      Math.floor(num / 1000);

    num %= 1000;

    if (crore > 0) {
      result +=
        convertBelowThousand(crore) +
        ' CRORE ';
    }

    if (lakh > 0) {
      result +=
        convertBelowThousand(lakh) +
        ' LAKH ';
    }

    if (thousand > 0) {
      result +=
        convertBelowThousand(thousand) +
        ' THOUSAND ';
    }

    if (num > 0) {
      result +=
        convertBelowThousand(num);
    }

    return result.trim();
  }
}