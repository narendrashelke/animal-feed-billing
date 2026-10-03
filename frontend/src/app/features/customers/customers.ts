import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-customers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.html',
  styleUrl: './customers.css'
})
export class Customers implements OnInit {

  customers: any[] = [];
  searchText = '';

  showForm = false;

  get filteredCustomers(): any[] {
    const search = this.searchText.trim().toLowerCase();
    if (!search) {
      return this.customers;
    }
    return this.customers.filter(c =>
      String(c.customer_code || '').toLowerCase().includes(search) ||
      String(c.name || '').toLowerCase().includes(search) ||
      String(c.village || '').toLowerCase().includes(search) ||
      String(c.taluka || '').toLowerCase().includes(search) ||
      String(c.district || '').toLowerCase().includes(search) ||
      String(c.mobile || '').toLowerCase().includes(search)
    );
  }

  customer = {
    customer_code: '',
    name: '',
    mobile: '',
    email: '',
    address: '',
    village: '',
    taluka: '',
    district: '',
    state: 'Maharashtra',
    state_code: '27',
    pincode: ''
  };

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadCustomers();
  }

  loadCustomers(): void {

    console.log('Loading customers...');

    this.http.get<any[]>('http://localhost:5000/api/customers')
      .subscribe({

        next: (data) => {

          console.log('CUSTOMERS API RESPONSE:', data);
          console.log('CUSTOMER COUNT:', data.length);

          this.customers = [...data];

          console.log('CUSTOMERS ARRAY:', this.customers);

          this.cdr.detectChanges();

        },

        error: (error) => {

          console.error('Error loading customers:', error);

        }

      });
  }

  isEditing = false;
  editingCustomerId: number | null = null;

  openAddCustomer(): void {
    this.isEditing = false;
    this.editingCustomerId = null;
    this.customer = {
      customer_code: '',
      name: '',
      mobile: '',
      email: '',
      address: '',
      village: '',
      taluka: '',
      district: '',
      state: 'Maharashtra',
      state_code: '27',
      pincode: ''
    };
    this.showForm = true;
  }

  openEditCustomer(item: any): void {
    if (!item) return;
    this.isEditing = true;
    this.editingCustomerId = item.id;
    this.customer = {
      customer_code: item.customer_code || '',
      name: item.name || '',
      mobile: item.mobile || '',
      email: item.email || '',
      address: item.address || '',
      village: item.village || '',
      taluka: item.taluka || '',
      district: item.district || '',
      state: item.state || 'Maharashtra',
      state_code: item.state_code || '27',
      pincode: item.pincode || ''
    };
    this.showForm = true;
  }

  closeForm(): void {
    this.showForm = false;
    this.isEditing = false;
    this.editingCustomerId = null;
  }

  saveCustomer(): void {
    if (!this.customer.customer_code || !this.customer.name) {
      alert('Customer Code and Customer Name are required.');
      return;
    }

    if (this.isEditing && this.editingCustomerId) {
      this.http.put<any>(
        `http://localhost:5000/api/customers/${this.editingCustomerId}`,
        this.customer
      ).subscribe({
        next: (res) => {
          alert(res?.message || 'Customer updated successfully!');
          this.closeForm();
          this.loadCustomers();
        },
        error: (error) => {
          console.error('Error updating customer:', error);
          if (error.status === 409) {
            alert('Customer code already exists.');
          } else {
            alert(error?.error?.error || 'Failed to update customer.');
          }
        }
      });
    } else {
      this.http.post(
        'http://localhost:5000/api/customers',
        this.customer
      ).subscribe({
        next: () => {
          alert('Customer added successfully!');
          this.closeForm();
          this.loadCustomers();
        },
        error: (error) => {
          console.error('Error adding customer:', error);
          if (error.status === 409) {
            alert('Customer code already exists.');
          } else {
            alert(error?.error?.error || 'Failed to add customer.');
          }
        }
      });
    }
  }

  deleteCustomer(item: any): void {
    if (!item || !item.id) {
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete customer "${item.name}" (${item.customer_code})?`
    );

    if (!confirmed) {
      return;
    }

    this.http.delete<any>(`http://localhost:5000/api/customers/${item.id}`)
      .subscribe({
        next: (res) => {
          alert(res?.message || 'Customer deleted successfully.');
          this.loadCustomers();
        },
        error: (err) => {
          console.error('Error deleting customer:', err);
          alert(err?.error?.error || 'Failed to delete customer.');
        }
      });
  }
}