const db = require('../_helpers/db');
const { Op } = require('sequelize');

module.exports = {
    createNotification,
    markAsRead,
    markAllAsRead,
    getNotifications,
    broadcastToRoles,
    hasRecentNotification,
    getAllAnnouncements,
    deleteAnnouncement,
    suspendAnnouncement,
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

async function markAllAsRead(accountId) {
    if (!accountId) throw new Error('Account ID is required');
    
    // Get user's role from account
    const account = await db.Account.findByPk(accountId);
    if (!account) throw new Error('Account not found');
    
    // Mark all unread notifications as read for this user's role and account
    const [updatedCount] = await db.Notification.update(
        { isRead: true },
        {
            where: {
                recipientRole: account.role,
                isRead: false,
                [Op.or]: [
                    { recipientAccountId: { [Op.is]: null } },
                    { recipientAccountId: accountId }
                ]
            }
        }
    );
    
    return { 
        message: 'All notifications marked as read',
        updatedCount 
    };
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

async function getAllAnnouncements({ limit = 50, offset = 0 } = {}) {
    const announcements = await db.Notification.findAll({
        where: {
            type: 'SYSTEM'
        },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
        attributes: ['id', 'title', 'message', 'recipientRole', 'metadata', 'isRead', 'createdAt', 'updatedAt']
    });
    return announcements;
}

async function deleteAnnouncement(announcementId) {
    const announcement = await db.Notification.findByPk(announcementId);
    if (!announcement) {
        throw new Error('Announcement not found');
    }
    if (announcement.type !== 'SYSTEM') {
        throw new Error('Only system announcements can be deleted');
    }
    await announcement.destroy();
    return { message: 'Announcement deleted successfully' };
}

async function suspendAnnouncement(announcementId) {
    const announcement = await db.Notification.findByPk(announcementId);
    if (!announcement) {
        throw new Error('Announcement not found');
    }
    if (announcement.type !== 'SYSTEM') {
        throw new Error('Only system announcements can be suspended');
    }
    
    // Mark as read for all users to effectively "suspend" it
    await db.Notification.update(
        { isRead: true },
        { 
            where: { 
                type: 'SYSTEM',
                title: announcement.title,
                message: announcement.message,
                createdAt: announcement.createdAt
            }
        }
    );
    
    return { message: 'Announcement suspended successfully' };
}


