const express = require('express');
const router = express.Router();
const accountService = require('./account.service');
const authorize = require('../_middleware/authorize');

// routes
router.post('/authenticate', authenticate);
router.post('/register', register);
router.post('/', ...authorize(['Admin', 'SuperAdmin']), createAccount);
router.get('/', ...authorize(['Admin', 'SuperAdmin']), getAll);
// SuperAdmin: pending list and account management
router.get('/pending', ...authorize(['SuperAdmin']), getPending);
router.patch('/:id/approve', ...authorize(['SuperAdmin']), approveAccount);
router.patch('/:id/reject', ...authorize(['SuperAdmin']), rejectAccount);
router.patch('/:id/role', ...authorize(['SuperAdmin']), setRole);
router.patch('/:id/status', ...authorize(['SuperAdmin']), setStatus);
router.get('/:id', ...authorize(['Admin', 'SuperAdmin']), getById);
router.put('/:id', ...authorize(['Admin', 'SuperAdmin']), update);
router.delete('/:id', ...authorize(['Admin', 'SuperAdmin']), _delete);

module.exports = router;

//  Authenticate
function authenticate(req, res, next) {
  console.log('🔐 Authentication request for:', req.body.email);
  accountService.authenticate(req.body)
    .then(account => {
      console.log('✅ Authentication successful, returning:', account);
      res.json(account);
    })
    .catch(error => {
      console.error('❌ Authentication failed:', error);
      next(error);
    });
}

// ➕ Register
function register(req, res, next) {
    accountService.create(req.body)
        .then(() => res.json({ message: 'Registration successful' }))
        .catch(next);
}

// ➕ Create Account (Admin function)
function createAccount(req, res, next) {
    accountService.create(req.body)
        .then(account => res.status(201).json({ 
            message: 'Account created successfully',
            account: account
        }))
        .catch(next);
}

//  Get all
function getAll(req, res, next) {
    accountService.getAll()
        .then(accounts => res.json(accounts))
        .catch(next);
}

// SuperAdmin controls
function getPending(req, res, next) {
    accountService.getPending()
        .then(list => res.json(list))
        .catch(next);
}

function approveAccount(req, res, next) {
    accountService.approveAccount(req.params.id)
        .then(acc => res.json({ message: 'Account approved', account: acc }))
        .catch(next);
}

function rejectAccount(req, res, next) {
    const { reason } = req.body || {};
    accountService.rejectAccount(req.params.id, reason)
        .then(acc => res.json({ message: 'Account rejected', account: acc }))
        .catch(next);
}

function setRole(req, res, next) {
    const { role } = req.body || {};
    accountService.setRole(req.params.id, role)
        .then(acc => res.json({ message: 'Role updated', account: acc }))
        .catch(next);
}

function setStatus(req, res, next) {
    const { status } = req.body || {};
    accountService.setStatus(req.params.id, status)
        .then(acc => res.json({ message: 'Status updated', account: acc }))
        .catch(next);
}

//  Get by ID
function getById(req, res, next) {
    accountService.getById(req.params.id)
        .then(account => account ? res.json(account) : res.sendStatus(404))
        .catch(next);
}

//  Update
function update(req, res, next) {
    accountService.update(req.params.id, req.body)
        .then(() => res.json({ message: 'Account updated successfully' }))
        .catch(next);
}

// Delete
function _delete(req, res, next) {
    accountService.delete(req.params.id)
        .then(() => res.json({ message: 'Account deleted successfully' }))
        .catch(next);
}
