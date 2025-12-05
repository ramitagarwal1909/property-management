const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Use Render's DATABASE_URL if available, otherwise use individual params
const pool = new Pool(
  process.env.postgresql://property_user:eQXjkBsxR5LsbyefjgpWainlgfVp1jOq@dpg-d4p5qg63jp1c73dt0h2g-a/property_management_zsr9
    ? { connectionString: process.env.postgresql://property_user:eQXjkBsxR5LsbyefjgpWainlgfVp1jOq@dpg-d4p5qg63jp1c73dt0h2g-a/property_management_zsr9, ssl: { rejectUnauthorized: false } }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'property_management',
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
      }
);

// [REST OF SERVER.JS CODE STAYS THE SAME - copy from previous artifact]

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err.stack);
  } else {
    console.log('Database connected successfully');
    release();
  }
});

// Initialize database tables
async function initializeDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        address VARCHAR(255) NOT NULL,
        units INTEGER NOT NULL,
        occupied INTEGER DEFAULT 0,
        rent DECIMAL(10, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        property VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        rent DECIMAL(10, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'current',
        phone VARCHAR(50),
        email VARCHAR(255),
        lease_end DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS maintenance_requests (
        id SERIAL PRIMARY KEY,
        property VARCHAR(255) NOT NULL,
        unit VARCHAR(50) NOT NULL,
        tenant VARCHAR(255) NOT NULL,
        issue TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        priority VARCHAR(50) DEFAULT 'medium',
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_tenants_property ON tenants(property);
      CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_requests(status);
      CREATE INDEX IF NOT EXISTS idx_maintenance_property ON maintenance_requests(property);
    `);
    console.log('Database tables initialized');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    client.release();
  }
}

initializeDatabase();

// ============= PROPERTIES ENDPOINTS =============

// GET all properties
app.get('/api/properties', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM properties ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single property
app.get('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM properties WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create property
app.post('/api/properties', async (req, res) => {
  try {
    const { name, address, units, rent } = req.body;
    
    if (!name || !address || !units || !rent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      'INSERT INTO properties (name, address, units, occupied, rent) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, address, units, 0, rent]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update property
app.put('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, units, occupied, rent } = req.body;
    
    const result = await pool.query(
      'UPDATE properties SET name = $1, address = $2, units = $3, occupied = $4, rent = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *',
      [name, address, units, occupied, rent, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE property
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM properties WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json({ message: 'Property deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============= TENANTS ENDPOINTS =============

// GET all tenants
app.get('/api/tenants', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tenants ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single tenant
app.get('/api/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create tenant
app.post('/api/tenants', async (req, res) => {
  try {
    const { name, property, unit, rent, phone, email, lease_end } = req.body;
    
    if (!name || !property || !unit || !rent) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      'INSERT INTO tenants (name, property, unit, rent, status, phone, email, lease_end) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [name, property, unit, rent, 'current', phone, email, lease_end]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update tenant
app.put('/api/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, property, unit, rent, status, phone, email, lease_end } = req.body;
    
    const result = await pool.query(
      'UPDATE tenants SET name = $1, property = $2, unit = $3, rent = $4, status = $5, phone = $6, email = $7, lease_end = $8, updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *',
      [name, property, unit, rent, status, phone, email, lease_end, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE tenant
app.delete('/api/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM tenants WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json({ message: 'Tenant deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============= MAINTENANCE ENDPOINTS =============

// GET all maintenance requests
app.get('/api/maintenance', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM maintenance_requests';
    let params = [];
    
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET single maintenance request
app.get('/api/maintenance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM maintenance_requests WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance request not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create maintenance request
app.post('/api/maintenance', async (req, res) => {
  try {
    const { property, unit, tenant, issue, priority } = req.body;
    
    if (!property || !unit || !tenant || !issue) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      'INSERT INTO maintenance_requests (property, unit, tenant, issue, status, priority, date) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE) RETURNING *',
      [property, unit, tenant, issue, 'pending', priority || 'medium']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH update maintenance status
app.patch('/api/maintenance/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const result = await pool.query(
      'UPDATE maintenance_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance request not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE maintenance request
app.delete('/api/maintenance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM maintenance_requests WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Maintenance request not found' });
    }
    res.json({ message: 'Maintenance request deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============= STATISTICS ENDPOINT =============

app.get('/api/stats', async (req, res) => {
  try {
    const propertiesCount = await pool.query('SELECT COUNT(*) as count FROM properties');
    const totalUnits = await pool.query('SELECT SUM(units) as total FROM properties');
    const totalOccupied = await pool.query('SELECT SUM(occupied) as total FROM properties');
    const monthlyRevenue = await pool.query('SELECT SUM(rent) as total FROM tenants WHERE status = $1', ['current']);
    const openRequests = await pool.query('SELECT COUNT(*) as count FROM maintenance_requests WHERE status != $1', ['completed']);

    res.json({
      properties: parseInt(propertiesCount.rows[0].count),
      totalUnits: parseInt(totalUnits.rows[0].total) || 0,
      totalOccupied: parseInt(totalOccupied.rows[0].total) || 0,
      monthlyRevenue: parseFloat(monthlyRevenue.rows[0].total) || 0,
      openRequests: parseInt(openRequests.rows[0].count)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
});
