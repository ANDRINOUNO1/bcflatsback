const express = require('express');
const router = express.Router();
const authorize = require('../_middleware/authorize');
const Role = require('../_helpers/role');
const service = require('./notification.service');
const notificationHelper = require('./notification.helper');

// Get notifications for current user/role
router.get('/', ...authorize(), async (req, res, next) => {
    try {
        const role = req.user.role;
        const accountId = req.user.id;
        const { limit } = req.query;
        const notifications = await service.getNotifications({ role, accountId, limit });
        res.json(notifications);
    } catch (err) { next(err); }
});

// Mark as read
router.post('/:id/read', ...authorize(), async (req, res, next) => {
    try {
        const notification = await service.markAsRead(req.params.id, req.user.id);
        res.json(notification);
    } catch (err) { next(err); }
});

// Mark all notifications as read
router.post('/mark-all-read', ...authorize(), async (req, res, next) => {
    try {
        const result = await service.markAllAsRead(req.user.id);
        res.json(result);
    } catch (err) { next(err); }
});

// Broadcast system announcement (Admin and SuperAdmin)
router.post('/broadcast', ...authorize([Role.Admin, Role.SuperAdmin]), async (req, res, next) => {
    try {
        const { title, message, roles } = req.body;
        
        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required' });
        }
        
        const targetRoles = roles || ['Admin', 'SuperAdmin', 'Accounting', 'Tenant'];
        await notificationHelper.notifySystemAnnouncement(title, message, targetRoles);
        
        res.json({ message: 'Announcement broadcasted successfully', title, targetRoles });
    } catch (err) { next(err); }
});

// Get all announcements (Admin and SuperAdmin only)
router.get('/announcements', ...authorize([Role.Admin, Role.SuperAdmin]), async (req, res, next) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const announcements = await service.getAllAnnouncements({ limit, offset });
        res.json(announcements);
    } catch (err) { next(err); }
});

// Delete announcement (Admin and SuperAdmin only)
router.delete('/announcements/:id', ...authorize([Role.Admin, Role.SuperAdmin]), async (req, res, next) => {
    try {
        const result = await service.deleteAnnouncement(req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

// Suspend announcement (Admin and SuperAdmin only)
router.post('/announcements/:id/suspend', ...authorize([Role.Admin, Role.SuperAdmin]), async (req, res, next) => {
    try {
        const result = await service.suspendAnnouncement(req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

module.exports = router;


