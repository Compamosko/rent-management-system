const express = require('express');
const bodyParser = require('body-parser');
const connection = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Route to add apartments
app.post('/add-apartment', (req, res) => {
  const { type, number } = req.body;
  const query = 'INSERT INTO apartments (type, number) VALUES (?, ?)';
  connection.query(query, [type, number], (error, results) => {
    if (error) {
      return res.status(500).json({ error: 'Error adding apartment' });
    }
    res.json({ message: 'Apartment added successfully', apartmentId: results.insertId });
  });
});

// Route to add tenants
app.post('/add-tenant', (req, res) => {
  const { name, apartmentId, rentDue } = req.body;
  const query = 'INSERT INTO tenants (name, apartment_id, rent_due, rent_paid) VALUES (?, ?, ?, 0)';
  connection.query(query, [name, apartmentId, rentDue], (error, results) => {
    if (error) {
      return res.status(500).json({ error: 'Error adding tenant' });
    }
    res.json({ message: 'Tenant added successfully', tenantId: results.insertId });
  });
});

// Route to process rent payment
app.post('/pay-rent', (req, res) => {
  const { tenantId, amount } = req.body;
  connection.query('SELECT * FROM tenants WHERE id = ?', [tenantId], (error, results) => {
    if (error || results.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    const tenant = results[0];
    tenant.rent_paid += amount;
    let paymentStatus = 'Not Paid';
    if (tenant.rent_paid >= tenant.rent_due) {
      paymentStatus = 'Paid';
    } else if (tenant.rent_paid > 0 && tenant.rent_paid < tenant.rent_due) {
      paymentStatus = 'Defaulting';
    }
    const updateQuery = 'UPDATE tenants SET rent_paid = ?, payment_status = ? WHERE id = ?';
    connection.query(updateQuery, [tenant.rent_paid, paymentStatus, tenantId], (updateError) => {
      if (updateError) {
        return res.status(500).json({ error: 'Error processing payment' });
      }
      res.json({ message: 'Payment processed successfully', tenant });
    });
  });
});

// Route to get report
app.get('/report', (req, res) => {
  const report = {};
  connection.query('SELECT COUNT(*) AS totalApartments FROM apartments', (error, results) => {
    if (error) {
      return res.status(500).json({ error: 'Error fetching apartments count' });
    }
    report.totalApartments = results[0].totalApartments;
    connection.query('SELECT type, COUNT(*) AS count FROM apartments GROUP BY type', (typeError, typeResults) => {
      if (typeError) {
        return res.status(500).json({ error: 'Error fetching apartment types' });
      }
      report.apartmentTypes = typeResults.reduce((acc, row) => {
        acc[row.type] = row.count;
        return acc;
      }, {});
      connection.query('SELECT payment_status, COUNT(*) AS count FROM tenants GROUP BY payment_status', (tenantError, tenantResults) => {
        if (tenantError) {
          return res.status(500).json({ error: 'Error fetching tenants report' });
        }
        report.tenants = tenantResults.reduce((acc, row) => {
          acc[row.payment_status] = row.count;
          return acc;
        }, {});
        res.json(report);
      });
    });
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

