
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

    if (!this.product.product_code.trim()) {
      this.errorMessage = 'Please enter the product code.';
      return;
    }

    if (!this.product.product_name.trim()) {
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
}