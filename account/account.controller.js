const express = require('express');
const router = express.Router();
const accountService = require('./account.service');
const authorize = require('../_middleware/authorize');

// routes
router.post('/authenticate', authenticate);
router.post('/register', register);
router.post('/', ...authorize(['Admin', 'SuperAdmin']), createAccount);
router.get('/', ...authorize(['Admin', 'SuperAdmin']), getAll);
router.get('/:id', ...authorize(['Admin', 'SuperAdmin']), getById);
router.put('/:id', ...authorize(['Admin', 'SuperAdmin']), update);
router.delete('/:id', ...authorize(['Admin', 'SuperAdmin']), _delete);

module.exports = router;

//  Authenticate
function authenticate(req, res, next) {
    accountService.authenticate(req.body)
        .then(account => res.json(account))
        .catch(next);
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
