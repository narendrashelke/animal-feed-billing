import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillHistory } from './bill-history';
import { provideRouter } from '@angular/router';

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('BillHistory', () => {
  let component: BillHistory;
  let fixture: ComponentFixture<BillHistory>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BillHistory],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BillHistory);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize search text', () => {
    expect(component.searchText).toBe('');
  });

  it('should hide invoice preview initially', () => {
    expect(component.showInvoice).toBe(false);
  });

  it('should return invoice number', () => {
    expect(
      component.getInvoiceNumber({
        id: 1,
        invoice_number: 'INV-001'
      } as any)
    ).toBe('INV-001');
  });

  it('should return current grand total', () => {
    component.selectedBill = {
      id: 1,
      grand_total: 5000
    } as any;

    expect(component.currentGrandTotal).toBe(5000);
  });

  it('should return Paid status', () => {
    expect(
      component.getPaymentStatus({
        grand_total: 1000,
        paid_amount: 1000,
        due_amount: 0
      } as any)
    ).toBe('Paid');
  });

  it('should return Partial status', () => {
    expect(
      component.getPaymentStatus({
        grand_total: 1000,
        paid_amount: 500,
        due_amount: 500
      } as any)
    ).toBe('Partial');
  });

  it('should return Pending status', () => {
    expect(
      component.getPaymentStatus({
        grand_total: 1000,
        paid_amount: 0,
        due_amount: 1000
      } as any)
    ).toBe('Pending');
  });

  it('should calculate item amount', () => {
    expect(
      component.getItemAmount({
        quantity: 2,
        rate: 1000
      } as any)
    ).toBe(2000);
  });

  it('should calculate total quantity', () => {
    expect(
      component.getTotalQuantity([
        { quantity: 2 },
        { quantity: 3 }
      ] as any)
    ).toBe(5);
  });
});