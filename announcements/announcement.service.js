const db = require('../_helpers/db');
const { Op } = require('sequelize');
const { literal } = require('sequelize');

module.exports = {
    createAnnouncement,
    getAnnouncements,
    getAnnouncementById,
    updateAnnouncement,
    deleteAnnouncement,
    publishAnnouncement,
    suspendAnnouncement,
    getAnnouncementStats,
    markAsRead
};

// Create a new announcement
async function createAnnouncement(announcementData) {
    try {
        const {
            title,
            message,
            targetRoles,
            priority = 'Medium',
            scheduledAt = null,
            expiresAt = null,
            createdBy,
            metadata = {}
        } = announcementData;

        if (!title || !message || !targetRoles || !createdBy) {
            throw new Error('Missing required fields: title, message, targetRoles, createdBy');
        }

        if (!Array.isArray(targetRoles) || targetRoles.length === 0) {
            throw new Error('targetRoles must be a non-empty array');
        }

        const announcement = await db.Announcement.create({
            title,
            message,
            targetRoles,
            priority,
            status: 'Draft',
            scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            createdBy,
            metadata
        });

        return await getAnnouncementById(announcement.id);
    } catch (error) {
        throw new Error(`Failed to create announcement: ${error.message}`);
    }
}

// Get announcements with filtering
async function getAnnouncements(options = {}) {
    try {
        const {
            page = 1,
            limit = 50,
            status = null,
            priority = null,
            role = null,
            search = '',
            sortBy = 'createdAt',
            sortOrder = 'DESC'
        } = options;

        const offset = (page - 1) * limit;
        const where = {};

        // Add status filter
        if (status) {
            where.status = status;
        }

        // Add priority filter
        if (priority) {
            where.priority = priority;
        }

        // Add role filter
        if (role) {
            where[Op.and] = [
                literal(`JSON_CONTAINS(targetRoles, '"${role}"')`)
            ];
        }

        // Add search filter
        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { message: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await db.Announcement.findAndCountAll({
            where,
            include: [
                { model: db.Account, as: 'creator' }
            ],
            order: [[sortBy, sortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return {
            announcements: rows,
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            hasNextPage: page < Math.ceil(count / limit),
            hasPrevPage: page > 1
        };
    } catch (error) {
        throw new Error(`Failed to get announcements: ${error.message}`);
    }
}

// Get announcement by ID
async function getAnnouncementById(id) {
    try {
        const announcement = await db.Announcement.findByPk(id, {
            include: [
                { model: db.Account, as: 'creator' }
            ]
        });

        if (!announcement) {
            throw new Error('Announcement not found');
        }

        return announcement;
    } catch (error) {
        throw new Error(`Failed to get announcement: ${error.message}`);
    }
}

// Update announcement
async function updateAnnouncement(id, updateData) {
    try {
        const announcement = await db.Announcement.findByPk(id);
        
        if (!announcement) {
            throw new Error('Announcement not found');
        }

        // Don't allow updating published announcements
        if (announcement.status === 'Published') {
            throw new Error('Cannot update published announcement');
        }

        const allowedFields = ['title', 'message', 'targetRoles', 'priority', 'scheduledAt', 'expiresAt', 'metadata'];
        const updateFields = {};
        
        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updateFields[field] = updateData[field];
            }
        }

        await announcement.update(updateFields);
        return await getAnnouncementById(id);
    } catch (error) {
        throw new Error(`Failed to update announcement: ${error.message}`);
    }
}

// Delete announcement
async function deleteAnnouncement(id) {
    try {
        const announcement = await db.Announcement.findByPk(id);
        
        if (!announcement) {
            throw new Error('Announcement not found');
        }

        // Don't allow deleting published announcements
        if (announcement.status === 'Published') {
            throw new Error('Cannot delete published announcement');
        }

        await announcement.destroy();
        return { message: 'Announcement deleted successfully' };
    } catch (error) {
        throw new Error(`Failed to delete announcement: ${error.message}`);
    }
}

// Publish announcement
async function publishAnnouncement(id) {
    try {
        const announcement = await db.Announcement.findByPk(id);
        
        if (!announcement) {
            throw new Error('Announcement not found');
        }

        if (announcement.status === 'Published') {
            throw new Error('Announcement is already published');
        }

        announcement.status = 'Published';
        await announcement.save();

        return await getAnnouncementById(id);
    } catch (error) {
        throw new Error(`Failed to publish announcement: ${error.message}`);
    }
}

// Suspend announcement
async function suspendAnnouncement(id) {
    try {
        const announcement = await db.Announcement.findByPk(id);
        
        if (!announcement) {
            throw new Error('Announcement not found');
        }

        announcement.status = 'Suspended';
        await announcement.save();

        return await getAnnouncementById(id);
    } catch (error) {
        throw new Error(`Failed to suspend announcement: ${error.message}`);
    }
}

// Get announcement statistics
async function getAnnouncementStats() {
    try {
        const stats = await db.Announcement.getStats();
        
        // Additional stats
        const totalReads = await db.Announcement.sum('readCount') || 0;
        
        // Active announcements (published and not expired)
        const activeAnnouncements = await db.Announcement.count({
            where: {
                status: 'Published',
                [Op.or]: [
                    { expiresAt: null },
                    { expiresAt: { [Op.gt]: new Date() } }
                ]
            }
        });

        return {
            ...stats,
            totalReads: parseInt(totalReads),
            activeAnnouncements
        };
    } catch (error) {
        throw new Error(`Failed to get announcement stats: ${error.message}`);
    }
}

// Mark announcement as read
async function markAsRead(announcementId, accountId) {
    try {
        const announcement = await db.Announcement.findByPk(announcementId);
        
        if (!announcement) {
            throw new Error('Announcement not found');
        }

        if (!announcement.canBeRead()) {
            throw new Error('Announcement is not available for reading');
        }

        await announcement.markAsRead(accountId);
        return { message: 'Announcement marked as read' };
    } catch (error) {
        throw new Error(`Failed to mark announcement as read: ${error.message}`);
    }
}
