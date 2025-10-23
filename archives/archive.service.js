const db = require('../_helpers/db');
const { Op } = require('sequelize');

module.exports = {
    archiveTenant,
    getArchivedTenants,
    getArchiveStats,
    restoreTenant,
    deleteArchive
};

// Archive a tenant (move from active tenants to archives)
async function archiveTenant(tenantId, archivedBy, archiveReason = 'Lease ended') {
    const transaction = await db.sequelize.transaction();
    try {
        // Get the tenant with all related data
        const tenant = await db.Tenant.findByPk(tenantId, {
            include: [
                { model: db.Account, as: 'account' },
                { model: db.Room, as: 'room' }
            ],
            transaction
        });

        if (!tenant) {
            throw new Error('Tenant not found');
        }

        if (tenant.status === 'Checked Out') {
            throw new Error('Tenant is already archived');
        }

        // Create archive record
        const archiveData = {
            tenantId: tenant.id,
            accountId: tenant.accountId,
            roomId: tenant.roomId,
            bedNumber: tenant.bedNumber,
            checkInDate: tenant.checkInDate,
            checkOutDate: new Date(),
            leaseStart: tenant.leaseStart,
            leaseEnd: tenant.leaseEnd,
            monthlyRent: tenant.monthlyRent,
            utilities: tenant.utilities,
            deposit: tenant.deposit,
            depositPaid: tenant.depositPaid,
            finalBalance: tenant.outstandingBalance,
            emergencyContact: tenant.emergencyContact,
            specialRequirements: tenant.specialRequirements,
            notes: tenant.notes,
            archivedBy: archivedBy,
            archiveReason: archiveReason
        };

        const archive = await db.Archive.create(archiveData, { transaction });

        // Update tenant status to checked out
        tenant.status = 'Checked Out';
        tenant.checkOutDate = new Date();
        await tenant.save({ transaction });

        await transaction.commit();

        // Return archive with populated data
        return await db.Archive.findByPk(archive.id, {
            include: [
                { model: db.Account, as: 'account' },
                { model: db.Room, as: 'room' },
                { model: db.Account, as: 'archivedByAccount' }
            ]
        });
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Failed to archive tenant: ${error.message}`);
    }
}

// Get archived tenants with filtering and pagination
async function getArchivedTenants(options = {}) {
    try {
        const {
            page = 1,
            limit = 50,
            sortBy = 'checkOutDate',
            sortOrder = 'DESC',
            search = '',
            startDate = null,
            endDate = null
        } = options;

        const offset = (page - 1) * limit;
        const where = {};

        // Add search filter
        if (search) {
            where[Op.or] = [
                { '$account.firstName$': { [Op.like]: `%${search}%` } },
                { '$account.lastName$': { [Op.like]: `%${search}%` } },
                { '$account.email$': { [Op.like]: `%${search}%` } },
                { '$room.roomNumber$': { [Op.like]: `%${search}%` } }
            ];
        }

        // Add date range filter
        if (startDate || endDate) {
            where.checkOutDate = {};
            if (startDate) where.checkOutDate[Op.gte] = new Date(startDate);
            if (endDate) where.checkOutDate[Op.lte] = new Date(endDate);
        }

        const { count, rows } = await db.Archive.findAndCountAll({
            where,
            include: [
                { model: db.Account, as: 'account' },
                { model: db.Room, as: 'room' },
                { model: db.Account, as: 'archivedByAccount' }
            ],
            order: [[sortBy, sortOrder]],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return {
            archives: rows,
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            hasNextPage: page < Math.ceil(count / limit),
            hasPrevPage: page > 1
        };
    } catch (error) {
        throw new Error(`Failed to get archived tenants: ${error.message}`);
    }
}

// Get archive statistics
async function getArchiveStats() {
    try {
        const stats = await db.Archive.getArchiveStats();
        
        // Additional stats
        const totalRevenue = await db.Archive.sum('monthlyRent') || 0;
        const totalUtilities = await db.Archive.sum('utilities') || 0;
        const totalDeposits = await db.Archive.sum('deposit') || 0;
        
        // Recent archives (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentArchives = await db.Archive.count({
            where: {
                checkOutDate: {
                    [Op.gte]: thirtyDaysAgo
                }
            }
        });

        return {
            ...stats,
            totalRevenue: parseFloat(totalRevenue),
            totalUtilities: parseFloat(totalUtilities),
            totalDeposits: parseFloat(totalDeposits),
            recentArchives
        };
    } catch (error) {
        throw new Error(`Failed to get archive stats: ${error.message}`);
    }
}

// Restore a tenant from archive (move back to active tenants)
async function restoreTenant(archiveId, restoredBy) {
    const transaction = await db.sequelize.transaction();
    try {
        const archive = await db.Archive.findByPk(archiveId, { transaction });
        
        if (!archive) {
            throw new Error('Archive record not found');
        }

        // Check if tenant still exists
        const existingTenant = await db.Tenant.findByPk(archive.tenantId, { transaction });
        
        if (existingTenant && existingTenant.status !== 'Checked Out') {
            throw new Error('Tenant is already active or in another status');
        }

        // Update tenant status back to active
        if (existingTenant) {
            existingTenant.status = 'Active';
            existingTenant.checkInDate = new Date();
            existingTenant.checkOutDate = null;
            await existingTenant.save({ transaction });
        } else {
            // Create new tenant record if it doesn't exist
            await db.Tenant.create({
                id: archive.tenantId,
                accountId: archive.accountId,
                roomId: archive.roomId,
                bedNumber: archive.bedNumber,
                checkInDate: new Date(),
                checkOutDate: null,
                leaseStart: archive.leaseStart,
                leaseEnd: archive.leaseEnd,
                status: 'Active',
                monthlyRent: archive.monthlyRent,
                utilities: archive.utilities,
                deposit: archive.deposit,
                depositPaid: archive.depositPaid,
                outstandingBalance: archive.finalBalance,
                emergencyContact: archive.emergencyContact,
                specialRequirements: archive.specialRequirements,
                notes: archive.notes
            }, { transaction });
        }

        // Delete the archive record
        await archive.destroy({ transaction });

        await transaction.commit();

        return { message: 'Tenant restored successfully' };
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Failed to restore tenant: ${error.message}`);
    }
}

// Permanently delete an archive record
async function deleteArchive(archiveId) {
    try {
        const archive = await db.Archive.findByPk(archiveId);
        
        if (!archive) {
            throw new Error('Archive record not found');
        }

        await archive.destroy();
        return { message: 'Archive record deleted successfully' };
    } catch (error) {
        throw new Error(`Failed to delete archive: ${error.message}`);
    }
}
