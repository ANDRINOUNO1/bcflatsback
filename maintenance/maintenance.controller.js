const express = require('express');
const router = express.Router();
const authorize = require('../_middleware/authorize');
const db = require('../_helpers/db');

// Create request (tenant)
router.post('/', authorize(), async (req, res, next) => {
  try {
    const { roomId, title, description, priority } = req.body;
    const request = await db.Maintenance.create({
      tenantId: req.user.id,
      roomId,
      title,
      description,
      priority: priority || 'Low'
    });
    res.json(request);
  } catch (err) { next(err); }
});

// List all (admin)
router.get('/', authorize(), async (req, res, next) => {
  try {
    // Only admins should see all; simple role check
    if (req.user.role !== 'Admin' && req.user.role !== 'admin') {
      // tenants: only own
      const list = await db.Maintenance.findAll({ where: { tenantId: req.user.id }, order: [['createdAt','DESC']] });
      return res.json(list);
    }
    const list = await db.Maintenance.findAll({ order: [['createdAt','DESC']] });
    res.json(list);
  } catch (err) { next(err); }
});

// Update status (admin)
router.patch('/:id/status', authorize(), async (req, res, next) => {
  try {
    if (req.user.role !== 'Admin' && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
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
    
    // Check if user is requesting their own requests or is admin
    if (req.user.role !== 'Admin' && req.user.role !== 'admin' && req.user.id !== parseInt(tenantId)) {
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

module.exports = router;


