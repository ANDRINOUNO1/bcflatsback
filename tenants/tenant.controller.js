const express = require('express');
const router = express.Router();
const tenantService = require('./tenant.service');
const authorize = require('../_middleware/authorize');

// Public routes
router.get('/stats', getTenantStats);

// Protected routes (require authentication)
router.get('/', ...authorize(), getAllTenants);
router.get('/active', ...authorize(), getActiveTenants);
router.get('/:id', ...authorize(), getTenantById);
router.post('/', ...authorize(['Admin', 'SuperAdmin']), createTenant);
router.put('/:id', ...authorize(['Admin', 'SuperAdmin']), updateTenant);
router.delete('/:id', ...authorize(['Admin', 'SuperAdmin']), deleteTenant);

// Tenant status management
router.patch('/:id/checkin', ...authorize(['Admin', 'SuperAdmin']), checkInTenant);
router.patch('/:id/checkout', ...authorize(['Admin', 'SuperAdmin']), checkOutTenant);
router.patch('/:id/status', ...authorize(['Admin', 'SuperAdmin']), updateTenantStatus);

// Tenant search and filtering
router.get('/search/account/:accountId', ...authorize(), getTenantsByAccount);
router.get('/search/room/:roomId', ...authorize(), getTenantsByRoom);

module.exports = router;

// Controller functions
async function getAllTenants(req, res, next) {
    try {
        const { floor } = req.query;
        const tenants = await tenantService.getAllTenants(floor);
        res.json(tenants);
    } catch (error) {
        next(error);
    }
}

async function getActiveTenants(req, res, next) {
    try {
        const tenants = await tenantService.getActiveTenants();
        res.json(tenants);
    } catch (error) {
        next(error);
    }
}

async function getTenantById(req, res, next) {
    try {
        const tenant = await tenantService.getTenantById(req.params.id);
        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }
        res.json(tenant);
    } catch (error) {
        next(error);
    }
}

async function getTenantStats(req, res, next) {
    try {
        const stats = await tenantService.getTenantStats();
        res.json(stats);
    } catch (error) {
        next(error);
    }
}

async function createTenant(req, res, next) {
    try {
        const tenant = await tenantService.createTenant(req.body);
        res.status(201).json(tenant);
    } catch (error) {
        next(error);
    }
}

async function updateTenant(req, res, next) {
    try {
        const tenant = await tenantService.updateTenant(req.params.id, req.body);
        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }
        res.json(tenant);
    } catch (error) {
        next(error);
    }
}

async function deleteTenant(req, res, next) {
    try {
        await tenantService.deleteTenant(req.params.id);
        res.json({ message: 'Tenant deleted successfully' });
    } catch (error) {
        next(error);
    }
}

async function checkInTenant(req, res, next) {
    try {
        const tenant = await tenantService.checkInTenant(req.params.id);
        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }
        res.json(tenant);
    } catch (error) {
        next(error);
    }
}

async function checkOutTenant(req, res, next) {
    try {
        const tenant = await tenantService.checkOutTenant(req.params.id);
        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }
        res.json(tenant);
    } catch (error) {
        next(error);
    }
}

async function updateTenantStatus(req, res, next) {
    try {
        const { status } = req.body;
        const tenant = await tenantService.updateTenantStatus(req.params.id, status);
        if (!tenant) {
            return res.status(404).json({ message: 'Tenant not found' });
        }
        res.json(tenant);
    } catch (error) {
        next(error);
    }
}

async function getTenantsByAccount(req, res, next) {
    try {
        const tenants = await tenantService.getTenantsByAccount(req.params.accountId);
        res.json(tenants);
    } catch (error) {
        next(error);
    }
}

async function getTenantsByRoom(req, res, next) {
    try {
        const tenants = await tenantService.getTenantsByRoom(req.params.roomId);
        res.json(tenants);
    } catch (error) {
        next(error);
    }
}
