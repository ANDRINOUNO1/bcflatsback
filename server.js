const express = require('express');
const cors = require('cors');
const config = require('./config.json');
const db = require('./_helpers/db');
const authorize = require('./_middleware/authorize');
const app = express();
const errorHandler = require('./_middleware/error-handler');

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:3000',
    'https://bcflats.onrender.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/accounts', require('./account/account.controller'));
app.use('/api/rooms', require('./rooms/room.controller'));
app.use('/api/tenants', require('./tenants/tenant.controller'));
app.use('/api/maintenance', require('./maintenance/maintenance.controller'));
app.use('/api/payments', require('./payments/payment.controller'));
app.use('/api/notifications', require('./notifications/notification.controller'));
app.use('/api/archives', require('./archives/archive.controller'));
app.use('/api/announcements', require('./announcements/announcement.controller'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'BCFlats Backend is running' });
});

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint hit from:', req.headers.origin);
  res.json({ 
    message: 'Backend is working!', 
    timestamp: new Date().toISOString(),
    origin: req.headers.origin 
  });
});

// Debug endpoint to check accounts
app.get('/api/debug/accounts', async (req, res) => {
  try {
    const db = require('./_helpers/db');
    const accounts = await db.Account.findAll();
    console.log('📊 Found accounts:', accounts.length);
    res.json({ 
      count: accounts.length,
      accounts: accounts.map(acc => ({ 
        id: acc.id, 
        email: acc.email, 
        role: acc.role, 
        status: acc.status 
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching accounts:', error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/test-auth', ...authorize(), async (req, res) => {
  try {
    const accountService = require('./account/account.service');
    const fullUserData = await accountService.basicDetails(req.user);
    
    res.json({ 
      status: 'OK', 
      message: 'Authentication successful',
      user: fullUserData
    });
  } catch (error) {
    console.error('❌ Error in test-auth endpoint:', error);
    res.status(500).json({ 
      status: 'ERROR', 
      message: 'Failed to get user data',
      error: error.message 
    });
  }
});

// Global error handler
app.use(errorHandler);

// Initialize database and start server
const port = config.port || 3000;

const startServer = async () => {
  try {
    // Initialize database
    await db.initialize();
    console.log('✅ Database initialized successfully');
    
    // Start server
    app.listen(port, () => {
      console.log(` BCFlats Backend server listening on port ${port}`);
      console.log(` API available at http://localhost:${port}/api`);
    });
  } catch (error) {
    console.error(' Failed to initialize database:', error);
    console.log('  Server will start without database connection');
    
    // Start server anyway
    app.listen(port, () => {
      console.log(` BCFlats Backend server listening on port ${port}`);
      console.log(` API available at http://localhost:${port}/api`);
    });
  }
};

startServer();