const db = require('../_helpers/db');
const { Op } = require('sequelize');

module.exports = {
    createNotification,
    markAsRead,
    getNotifications,
    broadcastToRoles,
    hasRecentNotification,
};

async function createNotification({ recipientRole, recipientAccountId = null, tenantId = null, type, title, message, metadata = {} }) {
    if (!recipientRole || !type || !title || !message) {
        throw new Error('Missing required fields for notification');
    }
    const notification = await db.Notification.create({
        recipientRole,
        recipientAccountId,
        tenantId,
        type,
        title,
        message,
        metadata,
        isRead: false,
    });
    return notification;
}

async function broadcastToRoles({ roles, tenantId = null, type, title, message, metadata = {} }) {
    if (!Array.isArray(roles) || roles.length === 0) {
        throw new Error('roles must be a non-empty array');
    }
    const payloads = roles.map(role => ({ recipientRole: role, tenantId, type, title, message, metadata }));
    const notifications = await db.Notification.bulkCreate(payloads);
    return notifications;
}

async function markAsRead(notificationId, accountId) {
    const notification = await db.Notification.findByPk(notificationId);
    if (!notification) throw new Error('Notification not found');
    // Optional rule: only the intended user or role can mark read; skip fine-grained checks for now
    notification.isRead = true;
    await notification.save();
    return notification;
}

async function getNotifications({ role, accountId = null, limit = 30 }) {
    if (!role) throw new Error('role is required');
    // Return both role-level (recipientAccountId IS NULL) and account-specific notifications
    const where = accountId ? {
        recipientRole: role,
        [Op.or]: [
            { recipientAccountId: { [Op.is]: null } },
            { recipientAccountId: accountId }
        ]
    } : { recipientRole: role };
    const notifications = await db.Notification.findAll({
        where,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
    });
    return notifications;
}

async function hasRecentNotification({ tenantId, type, days = 3 }) {
    if (!tenantId || !type) return false;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const exists = await db.Notification.findOne({
        where: {
            tenantId,
            type,
            createdAt: { [Op.gte]: since }
        }
    });
    return !!exists;
}


