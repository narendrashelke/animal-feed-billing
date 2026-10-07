
import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Product {
  id?: number;
  product_code: string;
  product_name: string;
  hsn_code: string;
  uom: string;
  weight: number;
  purchase_rate: number;
  selling_rate: number;
  gst_rate: number;
  stock_quantity: number;
  minimum_stock: number;
}

interface StockMovement {
  id: number;
  product_id: number;
  product_code: string;
  product_name: string;
  movement_type: string;
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  reason: string;
  reference_no?: string;
  created_at: string;
}

type InventoryAction = 'STOCK_IN' | 'ADJUSTMENT';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule
  ],
  templateUrl: './products.html',
  styleUrls: ['./products.css']
})
export class Products implements OnInit {

  private apiUrl = 'http://localhost:5000/api';

  // ==============================
  // PRODUCTS
  // ==============================

  products: Product[] = [];

  loadingProducts = false;

  showForm = false;

  savingProduct = false;

  message = '';

  errorMessage = '';

  product: Product = this.createEmptyProduct();

  private createEmptyProduct(): Product {
    return {
      product_code: '',
      product_name: '',
      hsn_code: '',
      uom: 'Bag',
      weight: 0,
      purchase_rate: 0,
      selling_rate: 0,
      gst_rate: 0,
      stock_quantity: 0,
      minimum_stock: 0
    };
  }

  // ==============================
  // INVENTORY FORM
  // ==============================

  showInventoryForm = false;

  savingInventory = false;

  inventoryAction: InventoryAction = 'STOCK_IN';

  selectedProductId: number | null = null;

  inventoryQuantity: number | null = null;

  inventoryReason = '';

  inventoryReference = '';

  inventoryMessage = '';

  inventoryError = '';

  get selectedProduct(): Product | null {
    if (this.selectedProductId === null) {
      return null;
    }

    return this.products.find(
      item => item.id === Number(this.selectedProductId)
    ) ?? null;
  }

  get inventoryFormTitle(): string {
    return this.inventoryAction === 'STOCK_IN'
      ? 'Stock In'
      : 'Stock Adjustment';
  }

  get inventoryQuantityLabel(): string {
    return this.inventoryAction === 'STOCK_IN'
      ? 'Quantity to Add'
      : 'Physical Counted Stock';
  }

  get expectedStock(): number {
    const current = Number(this.selectedProduct?.stock_quantity ?? 0);
    const quantity = Number(this.inventoryQuantity ?? 0);

    return this.inventoryAction === 'STOCK_IN'
      ? current + quantity
      : quantity;
  }

  // ==============================
  // INVENTORY HISTORY
  // ==============================

  movements: StockMovement[] = [];

  loadingHistory = false;

  historyError = '';

  // ==============================
  // CONSTRUCTOR
  // ==============================

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  // ==============================
  // LOAD PRODUCTS
  // ==============================

  loadProducts(): void {
    this.loadingProducts = true;
    this.errorMessage = '';

    this.http.get<Product[]>(`${this.apiUrl}/products`).subscribe({
      next: (data) => {
        this.products = Array.isArray(data) ? data : [];
        this.loadingProducts = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading products:', error);
        this.errorMessage =
          error?.error?.error || 'Unable to load products.';
        this.loadingProducts = false;
        this.cdr.detectChanges();
      }
    });
  }

  isEditing = false;
  editingProductId: number | null = null;

  // ==============================
  // ADD / EDIT PRODUCT FORM
  // ==============================

  openForm(): void {
    this.isEditing = false;
    this.editingProductId = null;
    this.product = this.createEmptyProduct();
    this.showForm = true;
    this.message = '';
    this.errorMessage = '';
  }

  openEditProduct(item: Product): void {
    if (!item) return;
    this.isEditing = true;
    this.editingProductId = item.id ?? null;
    this.product = { ...item };
    this.showForm = true;
    this.message = '';
    this.errorMessage = '';
  }

  closeForm(): void {
    this.showForm = false;
    this.isEditing = false;
    this.editingProductId = null;
    this.product = this.createEmptyProduct();
  }

  saveProduct(): void {
    this.message = '';
    this.errorMessage = '';

    if (!this.product.product_code || !this.product.product_code.trim()) {
      this.product.product_code = 'PROD-' + String(Date.now()).slice(-6);
    }

    if (!this.product.product_name || !this.product.product_name.trim()) {
      this.errorMessage = 'Please enter the product name.';
      return;
    }

    this.savingProduct = true;

    if (this.isEditing && this.editingProductId != null) {
      this.http.put<any>(
        `${this.apiUrl}/products/${this.editingProductId}`,
        this.product
      ).subscribe({
        next: (response) => {
          this.message = response?.message || 'Product updated successfully.';
          this.savingProduct = false;
          this.closeForm();
          this.loadProducts();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error updating product:', error);
          this.errorMessage =
            error?.error?.error ||
            error?.error?.message ||
            'Unable to update product.';
          this.savingProduct = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      this.http.post<any>(
        `${this.apiUrl}/products`,
        this.product
      ).subscribe({
        next: (response) => {
          this.message = response?.message || 'Product saved successfully.';
          this.savingProduct = false;
          this.closeForm();
          this.loadProducts();
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error saving product:', error);
          this.errorMessage =
            error?.error?.error ||
            error?.error?.message ||
            'Unable to save product.';
          this.savingProduct = false;
          this.cdr.detectChanges();
        }
      });
    }
  }

  // ==============================
  // OPEN INVENTORY FORM
  // HTML calls: openInventoryForm('STOCK_IN', item)
  // ==============================

  openInventoryForm(
    action: InventoryAction,
    product: Product
  ): void {
    this.inventoryAction = action;
    this.selectedProductId = product.id ?? null;

    this.inventoryQuantity = null;
    this.inventoryReason = '';
    this.inventoryReference = '';

    this.inventoryMessage = '';
    this.inventoryError = '';

    this.showInventoryForm = true;
  }

  closeInventoryForm(): void {
    this.showInventoryForm = false;
    this.selectedProductId = null;
    this.inventoryQuantity = null;
    this.inventoryReason = '';
    this.inventoryReference = '';
    this.inventoryError = '';
  }

  // ==============================
  // SUBMIT STOCK IN / ADJUSTMENT
  // ==============================

  submitInventory(): void {
    this.inventoryMessage = '';
    this.inventoryError = '';

    const product = this.selectedProduct;

    if (!product || product.id == null) {
      this.inventoryError = 'Please select a product.';
      return;
    }

    if (this.inventoryQuantity === null ||
        !Number.isFinite(Number(this.inventoryQuantity))) {
      this.inventoryError = 'Please enter a valid quantity.';
      return;
    }

    const quantity = Number(this.inventoryQuantity);

    if (this.inventoryAction === 'STOCK_IN' && quantity <= 0) {
      this.inventoryError = 'Stock In quantity must be greater than 0.';
      return;
    }

    if (this.inventoryAction === 'ADJUSTMENT' && quantity < 0) {
      this.inventoryError = 'Counted stock cannot be negative.';
      return;
    }

    if (!this.inventoryReason.trim()) {
      this.inventoryError = 'Please enter a reason.';
      return;
    }

    const endpoint = this.inventoryAction === 'STOCK_IN'
      ? `${this.apiUrl}/inventory/stock-in`
      : `${this.apiUrl}/inventory/adjustment`;

    const requestBody = this.inventoryAction === 'STOCK_IN'
      ? {
          product_id: product.id,
          quantity,
          reason: this.inventoryReason.trim(),
          reference_no: this.inventoryReference.trim()
        }
      : {
          product_id: product.id,
          counted_stock: quantity,
          reason: this.inventoryReason.trim(),
          reference_no: this.inventoryReference.trim()
        };

    this.savingInventory = true;

    this.http.post<any>(endpoint, requestBody).subscribe({
      next: (response) => {
        this.inventoryMessage =
          response?.message || 'Inventory updated successfully.';

        this.savingInventory = false;

        // Close the form
        this.showInventoryForm = false;
        this.selectedProductId = null;
        this.inventoryQuantity = null;
        this.inventoryReason = '';
        this.inventoryReference = '';

        this.loadProducts();

        // Refresh the history after the stock operation.
        this.loadInventoryHistory();
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Inventory update failed:', error);

        this.inventoryError =
          error?.error?.error ||
          error?.error?.message ||
          'Unable to update inventory.';

        this.savingInventory = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ==============================
  // LOAD ALL INVENTORY HISTORY
  // ==============================

  loadInventoryHistory(): void {
    this.loadingHistory = true;
    this.historyError = '';

    this.http.get<StockMovement[]>(
      `${this.apiUrl}/inventory/history`
    ).subscribe({
      next: (data) => {
        this.movements = Array.isArray(data) ? data : [];
        this.loadingHistory = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Unable to load inventory history:', error);

        this.movements = [];
        this.historyError =
          error?.error?.error ||
          error?.error?.message ||
          'Unable to load inventory history.';

        this.loadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ==============================
  // LOAD HISTORY FOR ONE PRODUCT
  // ==============================

  loadProductHistory(productId: number | undefined): void {
    if (productId == null) {
      this.historyError = 'Product ID is missing.';
      return;
    }

    this.loadingHistory = true;
    this.historyError = '';

    this.http.get<StockMovement[]>(
      `${this.apiUrl}/inventory/history?product_id=${productId}`
    ).subscribe({
      next: (data) => {
        this.movements = Array.isArray(data) ? data : [];
        this.loadingHistory = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Unable to load product history:', error);

        this.movements = [];
        this.historyError =
          error?.error?.error ||
          error?.error?.message ||
          'Unable to load product history.';

        this.loadingHistory = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ==============================
  // SHOW ALL HISTORY
  // ==============================

  showAllInventoryHistory(): void {
    this.loadInventoryHistory();
  }

  deleteProduct(item: Product): void {
    if (!item || !item.id) {
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete product "${item.product_name}" (${item.product_code})?`
    );

    if (!confirmed) {
      return;
    }

    this.http.delete<any>(`${this.apiUrl}/products/${item.id}`)
      .subscribe({
        next: (res) => {
          this.message = res?.message || 'Product deleted successfully.';
          this.loadProducts();
          this.loadInventoryHistory();
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error deleting product:', err);
          this.errorMessage = err?.error?.error || 'Failed to delete product.';
          this.cdr.detectChanges();
        }
      });
  }

  // ==============================
  // BULK IMPORT PRODUCTS
  // ==============================
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

    const parsedProducts: any[] = [];
    const hasHeader = lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('code') || lines[0].toLowerCase().includes('rate');
    const startIdx = hasHeader ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const cols = line.split(/[,;\t]/).map(c => c.trim().replace(/^["']|["']$/g, ''));

      if (cols.length === 1) {
        parsedProducts.push({ product_name: cols[0], selling_rate: 0, purchase_rate: 0, stock_quantity: 0 });
      } else if (cols.length >= 2) {
        let code = '';
        let name = '';
        let selling_rate = 0;
        let purchase_rate = 0;
        let stock_quantity = 0;
        let uom = 'Bag';
        let hsn_code = '';

        if (!isNaN(Number(cols[1])) && isNaN(Number(cols[0]))) {
          name = cols[0];
          selling_rate = Number(cols[1]) || 0;
          if (cols[2]) purchase_rate = Number(cols[2]) || 0;
          if (cols[3]) stock_quantity = Number(cols[3]) || 0;
          if (cols[4]) uom = cols[4];
        } else {
          code = cols[0];
          name = cols[1];
          if (cols[2]) selling_rate = Number(cols[2]) || 0;
          if (cols[3]) purchase_rate = Number(cols[3]) || 0;
          if (cols[4]) stock_quantity = Number(cols[4]) || 0;
          if (cols[5]) uom = cols[5];
        }

        parsedProducts.push({ product_code: code, product_name: name, selling_rate, purchase_rate, stock_quantity, uom, hsn_code });
      }
    }

    if (parsedProducts.length === 0) {
      alert('Could not parse any products from file.');
      return;
    }

    this.importing = true;
    this.http.post<any>(`${this.apiUrl}/products/import`, { products: parsedProducts }).subscribe({
      next: (res) => {
        alert(res?.message || `Successfully imported ${parsedProducts.length} product(s)!`);
        this.importing = false;
        this.closeImportModal();
        this.loadProducts();
      },
      error: (err) => {
        console.error('Import error:', err);
        alert(err?.error?.error || 'Failed to import products.');
        this.importing = false;
        this.cdr.detectChanges();
      }
    });
  }

  downloadSampleCsv(): void {
    const sample = "Product Code, Product Name, Selling Rate, Purchase Rate, Initial Stock, UOM\nPROD-001, Cattle Feed Supreme (50kg), 1450, 1250, 50, Bag\nPROD-002, Calf Growth Powder (1kg), 350, 280, 20, Packet";
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_products.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }
}