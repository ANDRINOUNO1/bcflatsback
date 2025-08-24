const express = require('express');
const cors = require('cors');
const config = require('./config.json');
const db = require('./_helpers/db');
const authorize = require('./_middleware/authorize');
const app = express();
const errorHandler = require('./_middleware/error-handler');

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Allow multiple origins
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/accounts', require('./account/account.controller'));
app.use('/api/rooms', require('./rooms/room.controller'));
app.use('/api/tenants', require('./tenants/tenant.controller'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'BCFlats Backend is running' });
});


app.get('/api/test-auth', ...authorize(), (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Authentication successful',
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status
    }
  });
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
      console.log(`🚀 BCFlats Backend server listening on port ${port}`);
      console.log(`📡 API available at http://localhost:${port}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    console.log('⚠️  Server will start without database connection');
    
    // Start server anyway
    app.listen(port, () => {
      console.log(`🚀 BCFlats Backend server listening on port ${port}`);
      console.log(`📡 API available at http://localhost:${port}/api`);
    });
  }
};

startServer();