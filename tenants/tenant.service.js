const db = require('../_helpers/db');

module.exports = {
    getAllTenants,
    getTenantById,
    getActiveTenants,
    getTenantStats,
    createTenant,
    updateTenant,
    deleteTenant,
    checkInTenant,
    checkOutTenant,
    updateTenantStatus,
    getTenantsByAccount,
    getTenantsByRoom
};

// Get all tenants with account and room information
async function getAllTenants(floor) {
    try {
        const roomInclude = {
            model: db.Room,
            as: 'room',
            attributes: ['id', 'roomNumber', 'floor', 'building', 'status']
        };

        if (floor !== undefined && floor !== null && floor !== '') {
            roomInclude.where = { floor };
            roomInclude.required = true; // only tenants on that floor
        }

        const tenants = await db.Tenant.findAll({
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'status']
                },
                roomInclude
            ],
            order: [['checkInDate', 'DESC']]
        });

        return tenants;
    } catch (error) {
        throw new Error(`Failed to get tenants: ${error.message}`);
    }
}

// Get tenant by ID with account and room information
async function getTenantById(id) {
    try {
        const tenant = await db.Tenant.findByPk(id, {
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'status']
                },
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'roomNumber', 'floor', 'building', 'status', 'monthlyRent', 'utilities']
                }
            ]
        });

        return tenant;
    } catch (error) {
        throw new Error(`Failed to get tenant: ${error.message}`);
    }
}

// Get active tenants
async function getActiveTenants() {
    try {
        const tenants = await db.Tenant.findAll({
            where: { status: 'Active' },
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'role']
                },
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'roomNumber', 'floor', 'building']
                }
            ],
            order: [['checkInDate', 'DESC']]
        });

        return tenants;
    } catch (error) {
        throw new Error(`Failed to get active tenants: ${error.message}`);
    }
}

// Get tenant statistics
async function getTenantStats() {
    try {
        return await db.Tenant.getTenantStats();
    } catch (error) {
        throw new Error(`Failed to get tenant stats: ${error.message}`);
    }
}

// Create new tenant
async function createTenant(tenantData) {
    try {
        // Validate required fields
        const { accountId, roomId, bedNumber, monthlyRent } = tenantData;
        
        if (!accountId || !roomId || !bedNumber || !monthlyRent) {
            throw new Error('Missing required fields: accountId, roomId, bedNumber, monthlyRent');
        }

        // Check if account exists
        const account = await db.Account.findByPk(accountId);
        if (!account) {
            throw new Error('Account not found');
        }

        // Check if room exists
        const room = await db.Room.findByPk(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        // Check if bed is available
        const existingTenant = await db.Tenant.findOne({
            where: { 
                roomId, 
                bedNumber, 
                status: 'Active' 
            }
        });

        if (existingTenant) {
            throw new Error(`Bed ${bedNumber} is already occupied in this room`);
        }

        // Check if room has available beds
        if (room.occupiedBeds >= room.totalBeds) {
            throw new Error('Room is fully occupied');
        }

        // Create tenant
        const tenant = await db.Tenant.create({
            ...tenantData,
            status: 'Pending',
            checkInDate: new Date()
        });

        // Update room occupancy
        await room.addTenant();

        // Return tenant with details
        return await getTenantById(tenant.id);
    } catch (error) {
        throw new Error(`Failed to create tenant: ${error.message}`);
    }
}

// Update tenant
async function updateTenant(id, updateData) {
    try {
        const tenant = await db.Tenant.findByPk(id);
        if (!tenant) return null;

        // Prevent updating certain fields if tenant is active
        if (tenant.status === 'Active') {
            delete updateData.roomId;
            delete updateData.bedNumber;
        }

        // If changing room or bed, validate availability
        if (updateData.roomId || updateData.bedNumber) {
            const newRoomId = updateData.roomId || tenant.roomId;
            const newBedNumber = updateData.bedNumber || tenant.bedNumber;

            const existingTenant = await db.Tenant.findOne({
                where: { 
                    roomId: newRoomId, 
                    bedNumber: newBedNumber, 
                    status: 'Active',
                    id: { [db.Sequelize.Op.ne]: id }
                }
            });

            if (existingTenant) {
                throw new Error(`Bed ${newBedNumber} is already occupied in the selected room`);
            }
        }

        await tenant.update(updateData);
        return await getTenantById(id);
    } catch (error) {
        throw new Error(`Failed to update tenant: ${error.message}`);
    }
}

// Delete tenant
async function deleteTenant(id) {
    try {
        const tenant = await db.Tenant.findByPk(id);
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        if (tenant.status === 'Active') {
            throw new Error('Cannot delete active tenant. Please check out first.');
        }

        // Update room occupancy if tenant was active
        if (tenant.status === 'Active') {
            const room = await db.Room.findByPk(tenant.roomId);
            if (room) {
                await room.removeTenant();
            }
        }

        await tenant.destroy();
        return true;
    } catch (error) {
        throw new Error(`Failed to delete tenant: ${error.message}`);
    }
}

// Check in tenant
async function checkInTenant(id) {
    try {
        const tenant = await db.Tenant.findByPk(id);
        if (!tenant) return null;

        if (tenant.status === 'Active') {
            throw new Error('Tenant is already checked in');
        }

        // Check if bed is still available
        const existingTenant = await db.Tenant.findOne({
            where: { 
                roomId: tenant.roomId, 
                bedNumber: tenant.bedNumber, 
                status: 'Active',
                id: { [db.Sequelize.Op.ne]: id }
            }
        });

        if (existingTenant) {
            throw new Error(`Bed ${tenant.bedNumber} is no longer available in this room`);
        }

        await tenant.checkIn();
        return await getTenantById(id);
    } catch (error) {
        throw new Error(`Failed to check in tenant: ${error.message}`);
    }
}

// Check out tenant
async function checkOutTenant(id) {
    try {
        const tenant = await db.Tenant.findByPk(id);
        if (!tenant) return null;

        if (tenant.status !== 'Active') {
            throw new Error('Tenant is not currently checked in');
        }

        await tenant.checkOut();

        // Update room occupancy
        const room = await db.Room.findByPk(tenant.roomId);
        if (room) {
            await room.removeTenant();
        }

        return await getTenantById(id);
    } catch (error) {
        throw new Error(`Failed to check out tenant: ${error.message}`);
    }
}

// Update tenant status
async function updateTenantStatus(id, status) {
    try {
        const tenant = await db.Tenant.findByPk(id);
        if (!tenant) return null;

        // Validate status transition
        if (tenant.status === 'Active' && status === 'Pending') {
            throw new Error('Cannot change active tenant to pending status');
        }

        if (status === 'Active' && tenant.status !== 'Pending') {
            throw new Error('Only pending tenants can be activated');
        }

        await tenant.update({ status });
        return await getTenantById(id);
    } catch (error) {
        throw new Error(`Failed to update tenant status: ${error.message}`);
    }
}

// Get tenants by account
async function getTenantsByAccount(accountId) {
    try {
        const tenants = await db.Tenant.findAll({
            where: { accountId },
            include: [
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'roomNumber', 'floor', 'building', 'status']
                }
            ],
            order: [['checkInDate', 'DESC']]
        });

        return tenants;
    } catch (error) {
        throw new Error(`Failed to get tenants by account: ${error.message}`);
    }
}

// Get tenants by room
async function getTenantsByRoom(roomId) {
    try {
        const tenants = await db.Tenant.findAll({
            where: { roomId },
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'avatar', 'role']
                }
            ],
            order: [['bedNumber', 'ASC']]
        });

        return tenants;
    } catch (error) {
        throw new Error(`Failed to get tenants by room: ${error.message}`);
    }
}
