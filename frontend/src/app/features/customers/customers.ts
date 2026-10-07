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
    if (!this.customer.name) {
      alert('Customer Name is required.');
      return;
    }

    if (!this.customer.customer_code || !this.customer.customer_code.trim()) {
      this.customer.customer_code = 'CUST-' + String(Date.now()).slice(-6);
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

  // BULK IMPORT
  showImportModal = false;
  importing = false;
  csvText = '';

  openImportModal(): void {
    this.csvText = '';
    this.showImportModal = true;
  }

  closeImportModal(): void {
    this.showImportModal = false;
    this.csvText = '';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.csvText = e.target.result || '';
      this.cdr.detectChanges();
    };
    reader.readAsText(file);
  }

  processImport(): void {
    if (!this.csvText.trim()) {
      alert('Please select a CSV file or paste CSV data.');
      return;
    }

    const lines = this.csvText.trim().split(/\r?\n/);
    if (lines.length === 0) {
      alert('No valid data lines found in CSV.');
      return;
    }

    const parsedCustomers: any[] = [];
    const hasHeader = lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('code') || lines[0].toLowerCase().includes('mobile');
    const startIdx = hasHeader ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));

      if (cols.length === 1) {
        parsedCustomers.push({ name: cols[0] });
      } else if (cols.length >= 2) {
        let code = '';
        let name = '';
        let mobile = '';
        let village = '';
        let address = '';

        if (/^\d{10}$/.test(cols[1])) {
          name = cols[0];
          mobile = cols[1];
          if (cols[2]) village = cols[2];
        } else {
          code = cols[0];
          name = cols[1];
          if (cols[2]) mobile = cols[2];
          if (cols[3]) village = cols[3];
          if (cols[4]) address = cols[4];
        }

        parsedCustomers.push({ customer_code: code, name, mobile, village, address });
      }
    }

    if (parsedCustomers.length === 0) {
      alert('Could not parse any customers from file.');
      return;
    }

    this.importing = true;
    this.http.post<any>('http://localhost:5000/api/customers/import', { customers: parsedCustomers }).subscribe({
      next: (res) => {
        alert(res?.message || `Successfully imported ${parsedCustomers.length} customer(s)!`);
        this.importing = false;
        this.closeImportModal();
        this.loadCustomers();
      },
      error: (err) => {
        console.error('Import error:', err);
        alert(err?.error?.error || 'Failed to import customers.');
        this.importing = false;
        this.cdr.detectChanges();
      }
    });
  }

  downloadSampleCsv(): void {
    const sample = "Customer Code, Customer Name, Mobile Number, Village, Address\nCUST-001, Ramesh Patil, 9822012345, Umbare, Main Road\nCUST-002, Suresh Shinde, 9822054321, Rahuri, Station Road";
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_customers.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }
}