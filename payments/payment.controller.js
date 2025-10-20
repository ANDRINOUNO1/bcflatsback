const express = require('express');
const router = express.Router();
const paymentService = require('./payment.service');
const authorize = require('../_middleware/authorize');
const db = require('../_helpers/db');
const notifications = require('../notifications/notification.service');

// Protected routes (require authentication)
// Backwards-compatible tenant history route
router.get('/tenant/:tenantId', ...authorize(), getPaymentsByTenant);
router.get('/stats', ...authorize(), getPaymentStats);
router.get('/recent', ...authorize(), getRecentPayments);
router.get('/billing-info', ...authorize(), getTenantsWithBillingInfo);
router.get('/dashboard-stats', ...authorize(), getDashboardStats);
router.post('/', ...authorize(['Admin', 'SuperAdmin']), recordPayment);
router.post('/process/:tenantId', ...authorize(['Admin', 'SuperAdmin']), processPayment);
router.post('/pending/:tenantId', ...authorize(['Tenant']), createPendingPayment);
router.post('/confirm/:paymentId', ...authorize(['Admin', 'SuperAdmin', 'Accounting']), confirmPayment);
router.get('/pending', ...authorize(['Admin', 'SuperAdmin', 'Accounting']), getPendingPayments);
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
        // Create overdue notifications for accounting/admin if needed (debounced)
        const now = new Date();
        const overdueTenants = tenants.filter(t => t.outstandingBalance > 0 && t.nextDueDate && new Date(t.nextDueDate) < now);
        for (const t of overdueTenants) {
            try {
                const already = await notifications.hasRecentNotification({ tenantId: t.id, type: 'overdue_notice', days: 2 });
                if (!already) {
                    await notifications.broadcastToRoles({
                        roles: ['Accounting', 'Admin', 'SuperAdmin'],
                        tenantId: t.id,
                        type: 'overdue_notice',
                        title: 'Overdue balance',
                        message: `Tenant #${t.id} is overdue. Balance: ${parseFloat(t.outstandingBalance).toFixed(2)}.`,
                        metadata: { tenantId: t.id, outstandingBalance: t.outstandingBalance }
                    });
                }
            } catch (e) {
                console.warn('Overdue notification error:', e.message);
            }
        }
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

async function getDashboardStats(req, res, next) {
    try {
        const stats = await paymentService.getDashboardStats();
        res.json(stats);
    } catch (error) {
        next(error);
    }
}

async function createPendingPayment(req, res, next) {
    try {
        const { tenantId } = req.params;
        const paymentData = {
            ...req.body,
            status: 'Pending'
        };
        
        const payment = await paymentService.createPendingPayment(tenantId, paymentData);
        res.status(201).json(payment);
    } catch (error) {
        next(error);
    }
}

async function confirmPayment(req, res, next) {
    try {
        const { paymentId } = req.params;
        const payment = await paymentService.confirmPayment(paymentId, req.user.id);
        res.json(payment);
    } catch (error) {
        next(error);
    }
}

async function getPendingPayments(req, res, next) {
    try {
        const payments = await paymentService.getPendingPayments();
        res.json(payments);
    } catch (error) {
        next(error);
    }
}
