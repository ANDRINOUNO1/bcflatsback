const express = require('express');
const app = express();
const errorHandler = require('./_middleware/error-handler');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/accounts', require('./accounts/account.controller'));

// Global error handler
app.use(errorHandler);

// Start server
const port = 3000;
app.listen(port, () => console.log('Server listening on port ' + port));