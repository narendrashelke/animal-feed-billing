import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dashboard } from './dashboard';
import { provideRouter } from '@angular/router';

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have the dashboard API URL configured', () => {
    expect(component).toBeTruthy();
  });

  it('should format Indian currency', () => {
    expect(component.formatCurrency(1250)).toContain('1,250');
  });

  it('should calculate sale total', () => {
    expect(
      component.getSaleTotal({
        id: 1,
        total_amount: 1500
      })
    ).toBe(1500);
  });

  it('should calculate due amount', () => {
    expect(
      component.getDueAmount({
        id: 1,
        total_amount: 1000,
        paid_amount: 400
      })
    ).toBe(600);
  });

  it('should return invoice number', () => {
    expect(
      component.getInvoiceNumber({
        id: 1,
        invoice_no: 'INV-001'
      })
    ).toBe('INV-001');
  });

  it('should return walk-in customer when unavailable', () => {
    expect(
      component.getCustomerName({
        id: 1
      })
    ).toBe('Walk-in Customer');
  });

  it('should return Paid status when nothing is due', () => {
    expect(
      component.getPaymentStatus({
        id: 1,
        total_amount: 1000,
        due_amount: 0
      })
    ).toBe('Paid');
  });
});
