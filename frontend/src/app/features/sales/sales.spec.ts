import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Sales } from './sales';
import { provideRouter } from '@angular/router';

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('Sales', () => {
  let component: Sales;
  let fixture: ComponentFixture<Sales>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sales],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Sales);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize payment details', () => {
    expect(component.paidAmount).toBe(0);
    expect(component.dueAmount).toBe(0);
    expect(component.paymentStatus).toBe('Pending');
  });

  it('should calculate payment as Pending when nothing is paid', () => {
    component.grandTotal = 1000;
    component.paidAmount = 0;
    component.calculatePayment();

    expect(component.dueAmount).toBe(1000);
    expect(component.paymentStatus).toBe('Pending');
  });

  it('should calculate payment as Partial', () => {
    component.grandTotal = 1000;
    component.paidAmount = 400;
    component.calculatePayment();

    expect(component.dueAmount).toBe(600);
    expect(component.paymentStatus).toBe('Partial');
  });

  it('should calculate payment as Paid', () => {
    component.grandTotal = 1000;
    component.paidAmount = 1000;
    component.calculatePayment();

    expect(component.dueAmount).toBe(0);
    expect(component.paymentStatus).toBe('Paid');
  });

  it('should not allow paid amount above grand total', () => {
    component.grandTotal = 1000;
    component.paidAmount = 1500;
    component.calculatePayment();

    expect(component.paidAmount).toBe(1000);
    expect(component.dueAmount).toBe(0);
    expect(component.paymentStatus).toBe('Paid');
  });

  it('should not allow negative paid amount', () => {
    component.grandTotal = 1000;
    component.paidAmount = -100;
    component.calculatePayment();

    expect(component.paidAmount).toBe(0);
    expect(component.dueAmount).toBe(1000);
    expect(component.paymentStatus).toBe('Pending');
  });
});
