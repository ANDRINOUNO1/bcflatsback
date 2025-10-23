const express = require('express');
const router = express.Router();
const authorize = require('../_middleware/authorize');
const db = require('../_helpers/db');

// Create request (tenant)
router.post('/', authorize(), async (req, res, next) => {
  try {
    const { roomId, title, description, priority } = req.body;
    
    // For testing purposes, if no tenant exists, create a dummy tenant or use a default
    let tenantId = req.user.id;
    
    // Check if tenant exists, if not, try to find or create one
    const existingTenant = await db.Tenant.findOne({ where: { accountId: req.user.id } });
    if (existingTenant) {
      tenantId = existingTenant.id;
    } else {
      // For testing: create a dummy tenant if none exists
      const dummyTenant = await db.Tenant.create({
        accountId: req.user.id,
        firstName: req.user.firstName || 'Test',
        lastName: req.user.lastName || 'Tenant',
        email: req.user.email,
        phone: '123-456-7890',
        roomId: roomId,
        bedNumber: 1,
        monthlyRent: 8000,
        utilities: 1000,
        deposit: 16000,
        checkInDate: new Date(),
        emergencyContact: {
          name: 'Emergency Contact',
          phone: '123-456-7890',
          relationship: 'Parent'
        },
        specialRequirements: 'None'
      });
      tenantId = dummyTenant.id;
    }
    
    const request = await db.Maintenance.create({
      tenantId: tenantId,
      roomId,
      title,
      description,
      priority: priority || 'Low'
    });
    res.json(request);
  } catch (err) { 
    console.error('Error creating maintenance request:', err);
    next(err); 
  }
});

// List all (admin, superadmin, headadmin)
router.get('/', authorize(), async (req, res, next) => {
  try {
    // Allow Admin, SuperAdmin, and HeadAdmin to see all maintenance requests
    const allowedRoles = ['Admin', 'admin', 'SuperAdmin', 'superadmin', 'HeadAdmin', 'headadmin'];
    if (!allowedRoles.includes(req.user.role)) {
      // tenants: only own
      const list = await db.Maintenance.findAll({ where: { tenantId: req.user.id }, order: [['createdAt','DESC']] });
      return res.json(list);
    }
    const list = await db.Maintenance.findAll({ order: [['createdAt','DESC']] });
    res.json(list);
  } catch (err) { next(err); }
});

// Update status (admin, superadmin, headadmin)
router.patch('/:id/status', authorize(), async (req, res, next) => {
  try {
    const allowedRoles = ['Admin', 'admin', 'SuperAdmin', 'superadmin', 'HeadAdmin', 'headadmin'];
    if (!allowedRoles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    const item = await db.Maintenance.findByPk(req.params.id);
    if (!item) return res.status(404).json({ message: 'Not found' });
    item.status = req.body.status || item.status;
    await item.save();
    res.json(item);
  } catch (err) { next(err); }
});

// Get maintenance requests by tenant
router.get('/tenant/:tenantId', authorize(), async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    
    // Check if user is admin, superadmin, or headadmin
    const allowedRoles = ['Admin', 'admin', 'SuperAdmin', 'superadmin', 'HeadAdmin', 'headadmin'];
    if (allowedRoles.includes(req.user.role)) {
      // Admin/SuperAdmin/HeadAdmin can access any tenant's maintenance requests
      const requests = await db.Maintenance.findAll({
        where: { tenantId: parseInt(tenantId) },
        order: [['createdAt', 'DESC']],
        include: [
          { model: db.Room, attributes: ['roomNumber', 'building'] },
          { model: db.Tenant, attributes: ['firstName', 'lastName'] }
        ]
      });
      return res.json(requests);
    }
    
    // For tenants, check if they have a tenant record linked to their account
    const tenant = await db.Tenant.findOne({ where: { accountId: req.user.id } });
    if (!tenant) {
      return res.status(403).json({ message: 'No tenant record found for this account' });
    }
    
    // Check if the tenant is requesting their own requests
    if (tenant.id !== parseInt(tenantId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const requests = await db.Maintenance.findAll({
      where: { tenantId: parseInt(tenantId) },
      order: [['createdAt', 'DESC']],
      include: [
        { model: db.Room, attributes: ['roomNumber', 'building'] },
        { model: db.Tenant, attributes: ['firstName', 'lastName'] }
      ]
    });
    
    res.json(requests);
  } catch (err) { next(err); }
});

// Get maintenance statistics (admin, superadmin, headadmin only)
router.get('/stats', authorize(), async (req, res, next) => {
  try {
    // Allow Admin, SuperAdmin, and HeadAdmin to access stats
    const allowedRoles = ['Admin', 'admin', 'SuperAdmin', 'superadmin', 'HeadAdmin', 'headadmin'];
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const [total, pending, ongoing, fixed] = await Promise.all([
      db.Maintenance.count(),
      db.Maintenance.count({ where: { status: 'Pending' } }),
      db.Maintenance.count({ where: { status: 'Ongoing' } }),
      db.Maintenance.count({ where: { status: 'Fixed' } })
    ]);
    
    res.json({
      total,
      pending,
      ongoing,
      fixed
    });
  } catch (err) { next(err); }
});

module.exports = router;