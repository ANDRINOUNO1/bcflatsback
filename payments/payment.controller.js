const express = require('express');
const router = express.Router();
const paymentService = require('./payment.service');
const authorize = require('../_middleware/authorize');

// Protected routes (require authentication)
// Backwards-compatible tenant history route
router.get('/tenant/:tenantId', ...authorize(), getPaymentsByTenant);
router.get('/stats', ...authorize(), getPaymentStats);
router.get('/recent', ...authorize(), getRecentPayments);
router.get('/billing-info', ...authorize(), getTenantsWithBillingInfo);
router.post('/', ...authorize(['Admin', 'SuperAdmin']), recordPayment);
router.post('/process/:tenantId', ...authorize(['Admin', 'SuperAdmin']), processPayment);
router.get('/id/:id', ...authorize(), getPaymentById);
router.get('/:tenantId', ...authorize(), getPaymentsByTenant);

module.exports = router;

// Controller functions
async function getPaymentsByTenant(req, res, next) {
    try {
        const { tenantId } = req.params;
        const { limit } = req.query;
        
        const payments = await paymentService.getPaymentsByTenant(tenantId, limit);
        res.json(payments);
    } catch (error) {
        next(error);
    }
}

async function getPaymentStats(req, res, next) {
    try {
        const { tenantId } = req.query;
        const stats = await paymentService.getPaymentStats(tenantId);
        res.json(stats);
    } catch (error) {
        next(error);
    }
}

async function getRecentPayments(req, res, next) {
    try {
        const { limit } = req.query;
        const payments = await paymentService.getRecentPayments(limit);
        res.json(payments);
    } catch (error) {
        next(error);
    }
}

async function getTenantsWithBillingInfo(req, res, next) {
    try {
        const tenants = await paymentService.getTenantsWithBillingInfo();
        res.json(tenants);
    } catch (error) {
        next(error);
    }
}

async function recordPayment(req, res, next) {
    try {
        const paymentData = {
            ...req.body,
            processedBy: req.user.id
        };
        
        const payment = await paymentService.recordPayment(paymentData);
        res.status(201).json(payment);
    } catch (error) {
        next(error);
    }
}

async function processPayment(req, res, next) {
    try {
        const { tenantId } = req.params;
        const paymentData = {
            ...req.body,
            processedBy: req.user.id
        };
        
        const payment = await paymentService.processPayment(tenantId, paymentData);
        res.status(201).json(payment);
    } catch (error) {
        next(error);
    }
}

async function getPaymentById(req, res, next) {
    try {
        const payment = await paymentService.getPaymentById(req.params.id);
        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }
        res.json(payment);
    } catch (error) {
        next(error);
    }
}
