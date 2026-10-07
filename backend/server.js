
const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 5000;

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(cors({
  origin: 'http://localhost:4200',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ======================================================
// DATABASE
// ======================================================

const dbPath = path.join(
  __dirname,
  '..',
  'database',
  'animal_feed.db'
);

const db = new Database(dbPath);

console.log('SQLite database connected:');
console.log(dbPath);

// ======================================================
// DATABASE MIGRATION - PAYMENT MODE
// ======================================================

// Add payment_mode to existing sales tables if necessary.
try {
  const salesColumns = db.prepare(
    'PRAGMA table_info(sales)'
  ).all();

  if (
    salesColumns.length > 0 &&
    !salesColumns.some(column => column.name === 'payment_mode')
  ) {
    db.exec(`
      ALTER TABLE sales
      ADD COLUMN payment_mode TEXT NOT NULL DEFAULT 'Cash'
    `);

    console.log('payment_mode column added successfully.');
  }
} catch (error) {
  console.error('Payment mode migration failed:', error.message);
}
/* ======================================================
   INVENTORY MIGRATION - STOCK MOVEMENT HISTORY
====================================================== */

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL
        CHECK (movement_type IN ('STOCK_IN', 'ADJUSTMENT')),
      quantity_change REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      reason TEXT NOT NULL,
      reference_no TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_stock_movements_product
    ON stock_movements(product_id);

    CREATE INDEX IF NOT EXISTS idx_stock_movements_created
    ON stock_movements(created_at);
  `);

  console.log('Stock movement table ready.');
} catch (error) {
  console.error('Stock movement migration failed:', error.message);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER,
      customer_id INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'Cash',
      reference_no TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE INDEX IF NOT EXISTS idx_customer_payments_customer
    ON customer_payments(customer_id);

    CREATE INDEX IF NOT EXISTS idx_customer_payments_sale
    ON customer_payments(sale_id);
  `);
  console.log('Customer payments table ready.');
} catch (error) {
  console.error('Customer payments migration failed:', error.message);
}

// ======================================================
// HEALTH ROUTE
// ======================================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Animal Feed Billing API is running'
  });
});

// ======================================================
// CUSTOMERS
// ======================================================

// GET ALL CUSTOMERS
app.get('/api/customers', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT *
      FROM customers
      ORDER BY id DESC
    `).all();

    res.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);

    res.status(500).json({
      error: 'Failed to fetch customers',
      details: error.message
    });
  }
});

// ADD CUSTOMER
app.post('/api/customers', (req, res) => {
  try {
    const {
      customer_code,
      name,
      mobile,
      email,
      address,
      village,
      taluka,
      district,
      state,
      state_code,
      pincode
    } = req.body;

    if (!customer_code || !name) {
      return res.status(400).json({
        error: 'Customer code and name are required'
      });
    }

    const existing = db.prepare(`
      SELECT id
      FROM customers
      WHERE customer_code = ?
    `).get(customer_code);

    if (existing) {
      return res.status(409).json({
        error: 'Customer code already exists'
      });
    }

    const result = db.prepare(`
      INSERT INTO customers (
        customer_code,
        name,
        mobile,
        email,
        address,
        village,
        taluka,
        district,
        state,
        state_code,
        pincode
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customer_code,
      name,
      mobile || '',
      email || '',
      address || '',
      village || '',
      taluka || '',
      district || '',
      state || '',
      state_code || '',
      pincode || ''
    );

    const customer = db.prepare(`
      SELECT *
      FROM customers
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(customer);
// BULK IMPORT CUSTOMERS
app.post('/api/customers/import', (req, res) => {
  try {
    const { customers } = req.body;
    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: 'Valid list of customers is required' });
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO customers (
        customer_code, name, mobile, email, address, village, taluka, district, state, state_code, pincode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let importedCount = 0;
    const importTx = db.transaction((list) => {
      list.forEach((c, index) => {
        const code = c.customer_code || c.code || `CUST-${Date.now()}-${index + 1}`;
        const name = c.name || c.customer_name || 'Customer ' + (index + 1);
        insertStmt.run(
          String(code).trim(),
          String(name).trim(),
          String(c.mobile || c.phone || '').trim(),
          String(c.email || '').trim(),
          String(c.address || '').trim(),
          String(c.village || '').trim(),
          String(c.taluka || '').trim(),
          String(c.district || '').trim(),
          String(c.state || 'Maharashtra').trim(),
          String(c.state_code || '27').trim(),
          String(c.pincode || '').trim()
        );
        importedCount++;
      });
    });

    importTx(customers);

    res.status(200).json({
      message: `Successfully imported ${importedCount} customer(s).`,
      count: importedCount
    });
  } catch (error) {
    console.error('Error importing customers:', error);
    res.status(500).json({ error: 'Failed to import customers', details: error.message });
  }
});

// UPDATE CUSTOMER
app.put('/api/customers/:id', (req, res) => {
  try {
    const customerId = Number(req.params.id);
    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: 'Invalid customer ID' });
    }

    const {
      customer_code,
      name,
      mobile,
      email,
      address,
      village,
      taluka,
      district,
      state,
      state_code,
      pincode
    } = req.body;

    if (!customer_code || !name) {
      return res.status(400).json({ error: 'Customer code and name are required' });
    }

    const existingCustomer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const duplicateCode = db.prepare('SELECT id FROM customers WHERE customer_code = ? AND id != ?').get(customer_code, customerId);
    if (duplicateCode) {
      return res.status(409).json({ error: 'Customer code already exists for another customer' });
    }

    db.prepare(`
      UPDATE customers
      SET customer_code = ?,
          name = ?,
          mobile = ?,
          email = ?,
          address = ?,
          village = ?,
          taluka = ?,
          district = ?,
          state = ?,
          state_code = ?,
          pincode = ?
      WHERE id = ?
    `).run(
      customer_code,
      name,
      mobile || '',
      email || '',
      address || '',
      village || '',
      taluka || '',
      district || '',
      state || '',
      state_code || '',
      pincode || '',
      customerId
    );

    const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    res.json({ message: 'Customer updated successfully', customer: updated });
  } catch (error) {
    console.error('Error updating customer:', error);
    res.status(500).json({ error: 'Failed to update customer', details: error.message });
  }
});

// ======================================================
// PRODUCTS
// ======================================================

// GET ALL PRODUCTS
app.get('/api/products', (req, res) => {
  try {
    const products = db.prepare(`
      SELECT
        id,
        product_code,
        product_name,
        category_id,
        hsn_code,
        uom,
        weight,
        purchase_rate,
        selling_rate,
        gst_rate,
        stock_quantity,
        minimum_stock
      FROM products
      ORDER BY id DESC
    `).all();

    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);

    res.status(500).json({
      error: 'Failed to fetch products',
      details: error.message
    });
  }
});

// ADD PRODUCT
app.post('/api/products', (req, res) => {
  try {
    const {
      product_code,
      product_name,
      category_id,
      hsn_code,
      uom,
      weight,
      purchase_rate,
      selling_rate,
      gst_rate,
      stock_quantity,
      minimum_stock
    } = req.body;

    if (!product_code || !product_name) {
      return res.status(400).json({
        error: 'Product code and product name are required'
      });
    }

    const existing = db.prepare(`
      SELECT id
      FROM products
      WHERE product_code = ?
    `).get(product_code);

    if (existing) {
      return res.status(409).json({
        error: 'Product code already exists'
      });
    }

    const result = db.prepare(`
      INSERT INTO products (
        product_code,
        product_name,
        category_id,
        hsn_code,
        uom,
        weight,
        purchase_rate,
        selling_rate,
        gst_rate,
        stock_quantity,
        minimum_stock
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product_code,
      product_name,
      category_id || null,
      hsn_code || '',
      uom || 'Kg',
      Number(weight) || 0,
      Number(purchase_rate) || 0,
      Number(selling_rate) || 0,
      Number(gst_rate) || 0,
      Number(stock_quantity) || 0,
      Number(minimum_stock) || 0
    );

    const product = db.prepare(`
      SELECT *
      FROM products
      WHERE id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(product);
// BULK IMPORT PRODUCTS
app.post('/api/products/import', (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Valid list of products is required' });
    }

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO products (
        product_code, product_name, category_id, hsn_code, uom, weight, purchase_rate, selling_rate, gst_rate, stock_quantity, minimum_stock
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let importedCount = 0;
    const importTx = db.transaction((list) => {
      list.forEach((p, index) => {
        const code = p.product_code || p.code || `PROD-${Date.now()}-${index + 1}`;
        const name = p.product_name || p.name || 'Product ' + (index + 1);
        insertStmt.run(
          String(code).trim(),
          String(name).trim(),
          p.category_id || null,
          String(p.hsn_code || '').trim(),
          String(p.uom || 'Kg').trim(),
          Number(p.weight) || 0,
          Number(p.purchase_rate || p.rate) || 0,
          Number(p.selling_rate || p.rate) || 0,
          Number(p.gst_rate || p.gst) || 0,
          Number(p.stock_quantity || p.stock) || 0,
          Number(p.minimum_stock) || 0
        );
        importedCount++;
      });
    });

    importTx(products);

    res.status(200).json({
      message: `Successfully imported ${importedCount} product(s).`,
      count: importedCount
    });
  } catch (error) {
    console.error('Error importing products:', error);
    res.status(500).json({ error: 'Failed to import products', details: error.message });
  }
});

// UPDATE PRODUCT
app.put('/api/products/:id', (req, res) => {
  try {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const {
      product_code,
      product_name,
      category_id,
      hsn_code,
      uom,
      weight,
      purchase_rate,
      selling_rate,
      gst_rate,
      stock_quantity,
      minimum_stock
    } = req.body;

    if (!product_code || !product_name) {
      return res.status(400).json({ error: 'Product code and product name are required' });
    }

    const existingProduct = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const duplicateCode = db.prepare('SELECT id FROM products WHERE product_code = ? AND id != ?').get(product_code, productId);
    if (duplicateCode) {
      return res.status(409).json({ error: 'Product code already exists for another product' });
    }

    db.prepare(`
      UPDATE products
      SET product_code = ?,
          product_name = ?,
          category_id = ?,
          hsn_code = ?,
          uom = ?,
          weight = ?,
          purchase_rate = ?,
          selling_rate = ?,
          gst_rate = ?,
          stock_quantity = ?,
          minimum_stock = ?
      WHERE id = ?
    `).run(
      product_code,
      product_name,
      category_id || null,
      hsn_code || '',
      uom || 'Kg',
      Number(weight) || 0,
      Number(purchase_rate) || 0,
      Number(selling_rate) || 0,
      Number(gst_rate) || 0,
      Number(stock_quantity) || 0,
      Number(minimum_stock) || 0,
      productId
    );

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    res.json({ message: 'Product updated successfully', product: updated });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product', details: error.message });
  }
});

// DELETE CUSTOMER
app.delete('/api/customers/:id', (req, res) => {
  try {
    const customerId = Number(req.params.id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({
        error: 'Invalid customer ID'
      });
    }

    const customer = db.prepare(`
      SELECT id, name, customer_code
      FROM customers
      WHERE id = ?
    `).get(customerId);

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }

    const salesCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM sales
      WHERE customer_id = ?
    `).get(customerId);

    if (salesCount && salesCount.count > 0) {
      return res.status(400).json({
        error: `Cannot delete customer "${customer.name}" (${customer.customer_code}) because they have ${salesCount.count} existing bill(s).`
      });
    }

    db.prepare(`
      DELETE FROM customers
      WHERE id = ?
    `).run(customerId);

    res.json({
      message: `Customer "${customer.name}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      error: 'Failed to delete customer',
      details: error.message
    });
  }
});

// DELETE PRODUCT
app.delete('/api/products/:id', (req, res) => {
  try {
    const productId = Number(req.params.id);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: 'Invalid product ID'
      });
    }

    const product = db.prepare(`
      SELECT id, product_name, product_code
      FROM products
      WHERE id = ?
    `).get(productId);

    if (!product) {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    const salesCount = db.prepare(`
      SELECT COUNT(*) AS count
      FROM sale_items
      WHERE product_id = ?
    `).get(productId);

    if (salesCount && salesCount.count > 0) {
      return res.status(400).json({
        error: `Cannot delete product "${product.product_name}" (${product.product_code}) because it has ${salesCount.count} sales record(s).`
      });
    }

    db.prepare(`
      DELETE FROM stock_movements
      WHERE product_id = ?
    `).run(productId);

    db.prepare(`
      DELETE FROM products
      WHERE id = ?
    `).run(productId);

    res.json({
      message: `Product "${product.product_name}" deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      error: 'Failed to delete product',
      details: error.message
    });
  }
});

/* ======================================================
   INVENTORY - STOCK IN
====================================================== */

app.post('/api/inventory/stock-in', (req, res) => {
  try {
    const productId = Number(req.body.product_id);
    const quantity = Number(req.body.quantity);
    const reason = String(req.body.reason || '').trim();
    const referenceNo = String(req.body.reference_no || '').trim();

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: 'Valid product ID is required'
      });
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return res.status(400).json({
        error: 'Stock-in quantity must be greater than zero'
      });
    }

    if (!reason) {
      return res.status(400).json({
        error: 'Reason is required'
      });
    }

    const stockIn = db.transaction(() => {
      const product = db.prepare(`
        SELECT id, stock_quantity
        FROM products
        WHERE id = ?
      `).get(productId);

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const previousStock = Number(product.stock_quantity) || 0;
      const newStock = previousStock + quantity;

      db.prepare(`
        UPDATE products
        SET stock_quantity = ?
        WHERE id = ?
      `).run(newStock, productId);

      db.prepare(`
        INSERT INTO stock_movements (
          product_id,
          movement_type,
          quantity_change,
          previous_stock,
          new_stock,
          reason,
          reference_no
        )
        VALUES (?, 'STOCK_IN', ?, ?, ?, ?, ?)
      `).run(
        productId,
        quantity,
        previousStock,
        newStock,
        reason,
        referenceNo || null
      );

      return {
        product_id: productId,
        previous_stock: previousStock,
        quantity_added: quantity,
        new_stock: newStock
      };
    });

    const result = stockIn();

    res.status(201).json({
      message: 'Stock added successfully',
      ...result
    });
  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    console.error('Stock-in error:', error);

    res.status(500).json({
      error: 'Failed to add stock',
      details: error.message
    });
  }
});


/* ======================================================
   INVENTORY - STOCK ADJUSTMENT
   Set stock to the verified physical count
====================================================== */

app.post('/api/inventory/adjustment', (req, res) => {
  try {
    const productId = Number(req.body.product_id);
    const countedStock = Number(req.body.counted_stock);
    const reason = String(req.body.reason || '').trim();
    const referenceNo = String(req.body.reference_no || '').trim();

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({
        error: 'Valid product ID is required'
      });
    }

    if (!Number.isFinite(countedStock) || countedStock < 0) {
      return res.status(400).json({
        error: 'Counted stock must be zero or greater'
      });
    }

    if (!reason) {
      return res.status(400).json({
        error: 'Adjustment reason is required'
      });
    }

    const adjustStock = db.transaction(() => {
      const product = db.prepare(`
        SELECT id, stock_quantity
        FROM products
        WHERE id = ?
      `).get(productId);

      if (!product) {
        throw new Error('PRODUCT_NOT_FOUND');
      }

      const previousStock = Number(product.stock_quantity) || 0;
      const quantityChange = countedStock - previousStock;

      db.prepare(`
        UPDATE products
        SET stock_quantity = ?
        WHERE id = ?
      `).run(countedStock, productId);

      db.prepare(`
        INSERT INTO stock_movements (
          product_id,
          movement_type,
          quantity_change,
          previous_stock,
          new_stock,
          reason,
          reference_no
        )
        VALUES (?, 'ADJUSTMENT', ?, ?, ?, ?, ?)
      `).run(
        productId,
        quantityChange,
        previousStock,
        countedStock,
        reason,
        referenceNo || null
      );

      return {
        product_id: productId,
        previous_stock: previousStock,
        quantity_change: quantityChange,
        new_stock: countedStock
      };
    });

    const result = adjustStock();

    res.status(201).json({
      message: 'Stock adjusted successfully',
      ...result
    });
  } catch (error) {
    if (error.message === 'PRODUCT_NOT_FOUND') {
      return res.status(404).json({
        error: 'Product not found'
      });
    }

    console.error('Stock adjustment error:', error);

    res.status(500).json({
      error: 'Failed to adjust stock',
      details: error.message
    });
  }
});


/* ======================================================
   INVENTORY - GET STOCK MOVEMENT HISTORY
====================================================== */

app.get('/api/inventory/history', (req, res) => {
  try {
    const productId = req.query.product_id
      ? Number(req.query.product_id)
      : null;

    if (
      productId !== null &&
      (!Number.isInteger(productId) || productId <= 0)
    ) {
      return res.status(400).json({
        error: 'Invalid product ID'
      });
    }

    let movements;

    if (productId !== null) {
      movements = db.prepare(`
        SELECT
          sm.*,
          p.product_code,
          p.product_name,
          p.uom
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE sm.product_id = ?
        ORDER BY sm.id DESC
      `).all(productId);
    } else {
      movements = db.prepare(`
        SELECT
          sm.*,
          p.product_code,
          p.product_name,
          p.uom
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        ORDER BY sm.id DESC
      `).all();
    }

    res.json(movements);
  } catch (error) {
    console.error('Stock history error:', error);

    res.status(500).json({
      error: 'Failed to fetch stock history',
      details: error.message
    });
  }
});
// ======================================================
// SALES - CREATE / SAVE BILL
// ======================================================

app.post('/api/sales', (req, res) => {
  try {
    const {
      customer_id,
      invoice_date,
      items,
      discount = 0,
      paid_amount = 0,
      payment_mode = 'Cash'
    } = req.body;

    // VALIDATION
    const customerId = Number(customer_id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({
        error: 'Customer is required'
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'At least one product is required'
      });
    }

    // Validate payment mode
    const allowedPaymentModes = [
      'Cash',
      'UPI',
      'Credit Card',
      'Debit Card',
      'Bank Transfer',
      'Cheque',
      'Credit',
      'Other'
    ];

    const selectedPaymentMode = String(payment_mode || 'Cash').trim();

    if (!allowedPaymentModes.includes(selectedPaymentMode)) {
      return res.status(400).json({
        error: 'Invalid payment mode'
      });
    }

    // CUSTOMER CHECK
    const customer = db.prepare(`
      SELECT id, customer_code, name
      FROM customers
      WHERE id = ?
    `).get(customerId);

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found'
      });
    }

    // INVOICE NUMBER
    const lastSale = db.prepare(`
      SELECT id
      FROM sales
      ORDER BY id DESC
      LIMIT 1
    `).get();

    const nextNumber = lastSale
      ? Number(lastSale.id) + 1
      : 1;

    const invoiceNo = 'INV-' + String(nextNumber).padStart(4, '0');

    const saleDate = invoice_date ||
      new Date().toISOString().slice(0, 10);

    // TRANSACTION
    const createSale = db.transaction(() => {
      let subtotal = 0;
      let totalTax = 0;

      const processedItems = [];

      // PROCESS PRODUCTS
      for (const item of items) {
        const productId = Number(item.product_id);
        const quantity = Number(item.quantity);

        if (!Number.isInteger(productId) || productId <= 0) {
          throw new Error('Invalid product ID');
        }

        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new Error('Quantity must be greater than zero');
        }

        const product = db.prepare(`
          SELECT
            id,
            product_code,
            product_name,
            hsn_code,
            uom,
            selling_rate,
            gst_rate,
            stock_quantity
          FROM products
          WHERE id = ?
        `).get(productId);

        if (!product) {
          throw new Error(`Product not found: ${productId}`);
        }

        const rate = Number(product.selling_rate) || 0;
        const gstRate = Number(product.gst_rate) || 0;

        const amount = quantity * rate;
        const gstAmount = amount * gstRate / 100;

        subtotal += amount;
        totalTax += gstAmount;

        processedItems.push({
          product,
          quantity,
          rate,
          gstRate,
          amount,
          gstAmount
        });
      }

      // DISCOUNT
      const discountAmount = Math.max(0, Number(discount) || 0);

      const taxableAmount = Math.max(
        0,
        subtotal - discountAmount
      );

      // TAX AFTER DISCOUNT
      let finalTax = 0;

      if (subtotal > 0) {
        finalTax = totalTax * (taxableAmount / subtotal);
      }

      // GST
      const cgst = finalTax / 2;
      const sgst = finalTax / 2;
      const igst = 0;

      // GRAND TOTAL
      const totalAmount = taxableAmount + finalTax;

      // PAYMENT
      const paid = Math.max(0, Number(paid_amount) || 0);
      const dueAmount = Math.max(0, totalAmount - paid);

      let paymentStatus = 'UNPAID';

      if (paid > 0 && paid < totalAmount) {
        paymentStatus = 'PARTIAL';
      }

      if (paid >= totalAmount && totalAmount > 0) {
        paymentStatus = 'PAID';
      }

      // INSERT SALE
      const saleResult = db.prepare(`
        INSERT INTO sales (
          invoice_no,
          invoice_date,
          customer_id,
          transport_mode,
          place_of_supply,
          external_doc_no,
          dc_no,
          subtotal,
          discount,
          cgst,
          sgst,
          igst,
          total_tax,
          total_amount,
          paid_amount,
          due_amount,
          payment_status,
          payment_mode,
          created_by
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `).run(
        invoiceNo,
        saleDate,
        customerId,
        'By Road',
        '27-Maharashtra',
        null,
        null,
        subtotal,
        discountAmount,
        cgst,
        sgst,
        igst,
        finalTax,
        totalAmount,
        paid,
        dueAmount,
        paymentStatus,
        selectedPaymentMode,
        null
      );

      const saleId = Number(saleResult.lastInsertRowid);

      // INSERT SALE ITEMS
      const insertItem = db.prepare(`
        INSERT INTO sale_items (
          sale_id,
          product_id,
          description,
          hsn_code,
          uom,
          quantity,
          rate,
          discount,
          taxable_amount,
          cgst_rate,
          cgst_amount,
          sgst_rate,
          sgst_amount,
          igst_rate,
          igst_amount,
          amount
        )
        VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      // UPDATE STOCK
      const updateStock = db.prepare(`
        UPDATE products
        SET stock_quantity = stock_quantity - ?
        WHERE id = ?
      `);

      // SAVE ITEMS AND UPDATE STOCK
      for (const item of processedItems) {
        const itemDiscount = subtotal > 0
          ? discountAmount * (item.amount / subtotal)
          : 0;

        const itemTaxable = Math.max(
          0,
          item.amount - itemDiscount
        );

        const itemCgst = itemTaxable * item.gstRate / 100 / 2;
        const itemSgst = itemTaxable * item.gstRate / 100 / 2;

        const itemTotal = itemTaxable + itemCgst + itemSgst;

        insertItem.run(
          saleId,
          item.product.id,
          item.product.product_name,
          item.product.hsn_code || '',
          item.product.uom || '',
          item.quantity,
          item.rate,
          itemDiscount,
          itemTaxable,
          item.gstRate / 2,
          itemCgst,
          item.gstRate / 2,
          itemSgst,
          0,
          0,
          itemTotal
        );

        updateStock.run(item.quantity, item.product.id);
      }

      return saleId;
    });

    // EXECUTE TRANSACTION
    const saleId = createSale();

    // GET SAVED SALE
    const sale = db.prepare(`
      SELECT *
      FROM sales
      WHERE id = ?
    `).get(saleId);

    const saleItems = db.prepare(`
      SELECT
        si.*,
        p.product_code,
        p.product_name
      FROM sale_items si
      LEFT JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?
      ORDER BY si.id
    `).all(saleId);

    res.status(201).json({
      message: 'Bill saved successfully',
      sale,
      items: saleItems
    });
  } catch (error) {
    console.error('Error saving sale:', error);

    res.status(500).json({
      error: 'Failed to save bill',
      details: error.message
    });
  }
});

// ======================================================
// GET ALL SALES
// ======================================================

app.get('/api/sales', (req, res) => {
  try {
    const sales = db.prepare(`
      SELECT
        s.*,
        c.customer_code,
        c.name AS customer_name,
        c.mobile AS customer_mobile
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.id DESC
    `).all();

    res.json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);

    res.status(500).json({
      error: 'Failed to fetch sales',
      details: error.message
    });
  }
});

// ======================================================
// GET SINGLE SALE
// ======================================================

app.get('/api/sales/:id', (req, res) => {
  try {
    const saleId = Number(req.params.id);

    if (!Number.isInteger(saleId) || saleId <= 0) {
      return res.status(400).json({
        error: 'Invalid sale ID'
      });
    }

    const sale = db.prepare(`
      SELECT
        s.*,
        c.customer_code,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        c.address AS customer_address,
        c.village AS customer_village,
        c.taluka AS customer_taluka,
        c.district AS customer_district,
        c.state AS customer_state,
        c.state_code AS customer_state_code,
        c.pincode AS customer_pincode
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.id = ?
    `).get(saleId);

    if (!sale) {
      return res.status(404).json({
        error: 'Sale not found'
      });
    }

    const items = db.prepare(`
      SELECT
        si.*,
        p.product_code,
        p.product_name
      FROM sale_items si
      LEFT JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?
      ORDER BY si.id
    `).all(saleId);

    res.json({
      sale,
      items
    });
  } catch (error) {
    console.error('Error fetching sale:', error);

    res.status(500).json({
      error: 'Failed to fetch sale',
      details: error.message
    });
  }
});

// ======================================================
// BILL HISTORY - GET ALL BILLS
// ======================================================

app.get('/api/bills', (req, res) => {
  try {
    const bills = db.prepare(`
      SELECT
        s.id,
        s.invoice_no AS invoice_number,
        s.invoice_date,
        s.customer_id,
        c.customer_code,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        s.subtotal,
        s.discount,
        s.cgst,
        s.sgst,
        s.igst,
        s.total_tax AS gst_total,
        s.total_amount AS grand_total,
        s.paid_amount,
        s.due_amount,
        s.payment_status,
        s.payment_mode,
        s.created_at
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      ORDER BY s.id DESC
    `).all();

    res.json(bills);
  } catch (error) {
    console.error('Error fetching bills:', error);

    res.status(500).json({
      error: 'Failed to fetch bills',
      details: error.message
    });
  }
});

// ======================================================
// BILL HISTORY - GET SINGLE BILL
// ======================================================

app.get('/api/bills/:id', (req, res) => {
  try {
    const billId = Number(req.params.id);

    if (!Number.isInteger(billId) || billId <= 0) {
      return res.status(400).json({
        error: 'Invalid bill ID'
      });
    }

    const bill = db.prepare(`
      SELECT
        s.*,
        c.customer_code,
        c.name AS customer_name,
        c.mobile AS customer_mobile,
        c.email AS customer_email,
        c.address AS customer_address,
        c.village AS customer_village,
        c.taluka AS customer_taluka,
        c.district AS customer_district,
        c.state AS customer_state,
        c.state_code AS customer_state_code,
        c.pincode AS customer_pincode
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      WHERE s.id = ?
    `).get(billId);

    if (!bill) {
      return res.status(404).json({
        error: 'Bill not found'
      });
    }

    const items = db.prepare(`
      SELECT
        si.*,
        p.product_code,
        p.product_name
      FROM sale_items si
      LEFT JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?
      ORDER BY si.id
    `).all(billId);

    res.json({
      bill,
      sale: bill,
      items
    });
  } catch (error) {
    console.error('Error fetching bill:', error);

    res.status(500).json({
      error: 'Failed to fetch bill',
      details: error.message
    });
  }
});

// ======================================================
// BILL HISTORY - DELETE BILL
// ======================================================

app.delete('/api/bills/:id', (req, res) => {
  try {
    const billId = Number(req.params.id);

    if (!Number.isInteger(billId) || billId <= 0) {
      return res.status(400).json({
        error: 'Invalid bill ID'
      });
    }

    const deleteBill = db.transaction(() => {
      const bill = db.prepare(`
        SELECT id
        FROM sales
        WHERE id = ?
      `).get(billId);

      if (!bill) {
        throw new Error('Bill not found');
      }

      const items = db.prepare(`
        SELECT product_id, quantity
        FROM sale_items
        WHERE sale_id = ?
      `).all(billId);

      // Restore stock
      const restoreStock = db.prepare(`
        UPDATE products
        SET stock_quantity = stock_quantity + ?
        WHERE id = ?
      `);

      for (const item of items) {
        restoreStock.run(
          Number(item.quantity) || 0,
          Number(item.product_id)
        );
      }

      // Delete sale items
      db.prepare(`
        DELETE FROM sale_items
        WHERE sale_id = ?
      `).run(billId);

      // Delete sale
      db.prepare(`
        DELETE FROM sales
        WHERE id = ?
      `).run(billId);
    });

    deleteBill();

    res.json({
      message: 'Bill deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting bill:', error);

    if (error.message === 'Bill not found') {
      return res.status(404).json({
        error: 'Bill not found'
      });
    }

    res.status(500).json({
      error: 'Failed to delete bill',
      details: error.message
    });
  }
});

// ======================================================
// CUSTOMER PAYMENTS & DUE RECOVERY
// ======================================================

// GET CUSTOMERS SUMMARY (TOTAL BILLED, PAID, DUE, AND UNPAID BILLS)
app.get('/api/payments/customers-summary', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT 
        c.id AS customer_id,
        c.customer_code,
        c.name,
        c.mobile,
        c.village,
        c.taluka,
        c.district,
        COALESCE(SUM(s.total_amount), 0) AS total_billed,
        COALESCE(SUM(s.paid_amount), 0) AS total_paid,
        COALESCE(SUM(s.due_amount), 0) AS total_due
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id
      GROUP BY c.id
      ORDER BY total_due DESC, c.name ASC
    `).all();

    const getPendingSales = db.prepare(`
      SELECT id, invoice_no, invoice_date, total_amount, paid_amount, due_amount, payment_status
      FROM sales
      WHERE customer_id = ? AND due_amount > 0
      ORDER BY id ASC
    `);

    const result = customers.map(cust => ({
      ...cust,
      pending_bills: getPendingSales.all(cust.customer_id)
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching customer payments summary:', error);
    res.status(500).json({ error: 'Failed to fetch customer payments summary', details: error.message });
  }
});

// GET PAYMENT LEDGER / HISTORY
app.get('/api/payments', (req, res) => {
  try {
    const customerId = req.query.customer_id ? Number(req.query.customer_id) : null;
    let payments;
    if (customerId) {
      payments = db.prepare(`
        SELECT 
          p.*,
          c.customer_code,
          c.name AS customer_name,
          c.mobile AS customer_mobile,
          s.invoice_no
        FROM customer_payments p
        JOIN customers c ON c.id = p.customer_id
        LEFT JOIN sales s ON s.id = p.sale_id
        WHERE p.customer_id = ?
        ORDER BY p.id DESC
      `).all(customerId);
    } else {
      payments = db.prepare(`
        SELECT 
          p.*,
          c.customer_code,
          c.name AS customer_name,
          c.mobile AS customer_mobile,
          s.invoice_no
        FROM customer_payments p
        JOIN customers c ON c.id = p.customer_id
        LEFT JOIN sales s ON s.id = p.sale_id
        ORDER BY p.id DESC
      `).all();
    }
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments', details: error.message });
  }
});

// RECORD CUSTOMER PAYMENT
app.post('/api/payments', (req, res) => {
  try {
    const {
      customer_id,
      sale_id,
      payment_date,
      amount,
      payment_mode = 'Cash',
      reference_no = '',
      notes = ''
    } = req.body;

    const customerId = Number(customer_id);
    const payAmount = Number(amount);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: 'Valid customer ID is required' });
    }

    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    const customer = db.prepare('SELECT id, name FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const payDate = payment_date || new Date().toISOString().slice(0, 10);
    const saleId = sale_id ? Number(sale_id) : null;

    const executePayment = db.transaction(() => {
      const insertPayment = db.prepare(`
        INSERT INTO customer_payments (
          sale_id,
          customer_id,
          payment_date,
          amount,
          payment_mode,
          reference_no,
          notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        saleId,
        customerId,
        payDate,
        payAmount,
        payment_mode,
        reference_no || null,
        notes || null
      );

      let remainingPayment = payAmount;

      if (saleId) {
        const sale = db.prepare('SELECT id, total_amount, paid_amount, due_amount FROM sales WHERE id = ? AND customer_id = ?').get(saleId, customerId);
        if (!sale) {
          throw new Error('SALE_NOT_FOUND');
        }
        const newPaid = Number(sale.paid_amount) + payAmount;
        const newDue = Math.max(0, Number(sale.total_amount) - newPaid);
        const newStatus = newDue === 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');

        db.prepare(`
          UPDATE sales
          SET paid_amount = ?, due_amount = ?, payment_status = ?
          WHERE id = ?
        `).run(newPaid, newDue, newStatus, saleId);
      } else {
        const pendingSales = db.prepare(`
          SELECT id, total_amount, paid_amount, due_amount
          FROM sales
          WHERE customer_id = ? AND due_amount > 0
          ORDER BY id ASC
        `).all(customerId);

        for (const sale of pendingSales) {
          if (remainingPayment <= 0) break;

          const currentDue = Number(sale.due_amount);
          const applyAmount = Math.min(remainingPayment, currentDue);

          const newPaid = Number(sale.paid_amount) + applyAmount;
          const newDue = currentDue - applyAmount;
          const newStatus = newDue === 0 ? 'PAID' : 'PARTIAL';

          db.prepare(`
            UPDATE sales
            SET paid_amount = ?, due_amount = ?, payment_status = ?
            WHERE id = ?
          `).run(newPaid, newDue, newStatus, sale.id);

          remainingPayment -= applyAmount;
        }
      }

      return insertPayment.lastInsertRowid;
    });

    const paymentId = executePayment();

    res.status(201).json({
      message: 'Payment recorded successfully',
      payment_id: paymentId
    });
  } catch (error) {
    if (error.message === 'SALE_NOT_FOUND') {
      return res.status(404).json({ error: 'Invoice not found for this customer' });
    }
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment', details: error.message });
  }
});

// GET CUSTOMER LEDGER STATEMENT
app.get('/api/payments/statement/:customer_id', (req, res) => {
  try {
    const customerId = Number(req.params.customer_id);

    if (!Number.isInteger(customerId) || customerId <= 0) {
      return res.status(400).json({ error: 'Valid customer ID is required' });
    }

    const customer = db.prepare(`
      SELECT * FROM customers WHERE id = ?
    `).get(customerId);

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Fetch all sales invoices for this customer
    const sales = db.prepare(`
      SELECT id, invoice_no, invoice_date, grand_total, paid_amount, due_amount, payment_status, created_at
      FROM sales
      WHERE customer_id = ?
      ORDER BY id ASC
    `).all(customerId);

    // Fetch all payment records for this customer
    const payments = db.prepare(`
      SELECT p.*, s.invoice_no
      FROM customer_payments p
      LEFT JOIN sales s ON s.id = p.sale_id
      WHERE p.customer_id = ?
      ORDER BY p.id ASC
    `).all(customerId);

    // Combine into timeline
    let rawEntries = [];

    sales.forEach(s => {
      const rawDate = s.invoice_date || s.created_at || '';
      rawEntries.push({
        id: `INV-${s.id}`,
        timestamp: new Date(rawDate).getTime() || s.id,
        date: rawDate,
        type: 'INVOICE',
        reference_no: s.invoice_no || `INV-${s.id}`,
        description: `Bill of Supply (${s.payment_status || 'Pending'})`,
        debit: Number(s.grand_total) || 0,
        credit: 0
      });
    });

    payments.forEach(p => {
      const rawDate = p.payment_date || p.created_at || '';
      let desc = `Payment Received (${p.payment_mode || 'Cash'})`;
      if (p.invoice_no) {
        desc += ` for ${p.invoice_no}`;
      }
      if (p.notes) {
        desc += ` - ${p.notes}`;
      }

      rawEntries.push({
        id: `PAY-${p.id}`,
        timestamp: new Date(rawDate).getTime() || p.id,
        date: rawDate,
        type: 'PAYMENT',
        reference_no: p.reference_no || `PAY-${p.id}`,
        description: desc,
        debit: 0,
        credit: Number(p.amount) || 0
      });
    });

    // Sort by timestamp/date
    rawEntries.sort((a, b) => a.timestamp - b.timestamp);

    let runningBalance = 0;
    let totalBilled = 0;
    let totalPaid = 0;

    const ledgerEntries = rawEntries.map(entry => {
      if (entry.type === 'INVOICE') {
        runningBalance += entry.debit;
        totalBilled += entry.debit;
      } else if (entry.type === 'PAYMENT') {
        runningBalance -= entry.credit;
        totalPaid += entry.credit;
      }

      return {
        ...entry,
        running_balance: runningBalance
      };
    });

    res.json({
      customer,
      summary: {
        total_billed: totalBilled,
        total_paid: totalPaid,
        current_balance: runningBalance
      },
      ledger_entries: ledgerEntries
    });
  } catch (error) {
    console.error('Error fetching customer statement:', error);
    res.status(500).json({ error: 'Failed to fetch customer statement', details: error.message });
  }
});

// ======================================================
// SERVE PRODUCTION FRONTEND BUILD
// ======================================================

const distPath = path.join(__dirname, '..', 'frontend', 'dist', 'frontend', 'browser');
app.use(express.static(distPath));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  const indexPath = path.join(distPath, 'index.html');
  if (require('fs').existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, () => {
  console.log('');
  console.log('====================================');
  console.log(' Animal Feed Billing App');
  console.log('====================================');
  console.log(`Application & API running on http://localhost:${PORT}`);
  console.log('');
});