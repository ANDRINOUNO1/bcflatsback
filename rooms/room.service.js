const db = require('../_helpers/db');

module.exports = {
    getAllRooms,
    getRoomById,
    getAvailableRooms,
    getRoomStats,
    createRoom,
    updateRoom,
    deleteRoom,
    updateRoomStatus,
    setMaintenanceMode,
    addTenantToRoom,
    removeTenantFromRoom,
    getRoomTenants,
    getRoomBedStatus
};

// Get all rooms with tenant information
async function getAllRooms(floor) {
    try {
        const where = {};
        if (floor !== undefined && floor !== null && floor !== '') {
            where.floor = floor;
        }
        const rooms = await db.Room.findAll({
            where,
            include: [
                {
                    model: db.Tenant,
                    as: 'tenants',
                    where: { status: 'Active' },
                    required: false,
                    include: [
                        {
                            model: db.Account,
                            as: 'account',
                            attributes: ['id', 'firstName', 'lastName', 'email']
                        }
                    ]
                }
            ],
            order: [['roomNumber', 'ASC']]
        });

        return rooms.map(room => {
            const roomData = room.get({ plain: true });
            roomData.tenants = roomData.tenants || [];
            return roomData;
        });
    } catch (error) {
        throw new Error(`Failed to get rooms: ${error.message}`);
    }
}

// Get room by ID with tenant information
async function getRoomById(id) {
    try {
        const room = await db.Room.findByPk(id, {
            include: [
                {
                    model: db.Tenant,
                    as: 'tenants',
                    include: [
                        {
                            model: db.Account,
                            as: 'account',
                            attributes: ['id', 'firstName', 'lastName', 'email', 'avatar']
                        }
                    ]
                }
            ]
        });

        if (!room) return null;

        const roomData = room.get({ plain: true });
        roomData.tenants = roomData.tenants || [];
        return roomData;
    } catch (error) {
        throw new Error(`Failed to get room: ${error.message}`);
    }
}

// Get available rooms (with available beds)
async function getAvailableRooms() {
    try {
        const rooms = await db.Room.findAll({
            where: {
                status: ['Available', 'Partially Occupied']
            },
            order: [['roomNumber', 'ASC']]
        });

        return rooms.filter(room => room.availableBeds > 0);
    } catch (error) {
        throw new Error(`Failed to get available rooms: ${error.message}`);
    }
}

// Get room statistics
async function getRoomStats() {
    try {
        return await db.Room.getRoomStats();
    } catch (error) {
        throw new Error(`Failed to get room stats: ${error.message}`);
    }
}

// Create new room
async function createRoom(roomData) {
    try {
        // Validate room number uniqueness
        const existingRoom = await db.Room.findOne({
            where: { roomNumber: roomData.roomNumber }
        });

        if (existingRoom) {
            throw new Error('Room number already exists');
        }

        // Set default values
        const room = await db.Room.create({
            ...roomData,
            totalBeds: 4, // Always 4 beds per room
            occupiedBeds: 0,
            status: 'Available'
        });

        return room;
    } catch (error) {
        throw new Error(`Failed to create room: ${error.message}`);
    }
}

// Update room
async function updateRoom(id, updateData) {
    try {
        const room = await db.Room.findByPk(id);
        if (!room) return null;

        // Prevent updating room number if it already exists
        if (updateData.roomNumber && updateData.roomNumber !== room.roomNumber) {
            const existingRoom = await db.Room.findOne({
                where: { roomNumber: updateData.roomNumber }
            });

            if (existingRoom) {
                throw new Error('Room number already exists');
            }
        }

        // Prevent reducing total beds below occupied beds
        if (updateData.totalBeds && updateData.totalBeds < room.occupiedBeds) {
            throw new Error('Cannot reduce total beds below currently occupied beds');
        }

        await room.update(updateData);
        return room;
    } catch (error) {
        throw new Error(`Failed to update room: ${error.message}`);
    }
}

// Delete room
async function deleteRoom(id) {
    try {
        const room = await db.Room.findByPk(id);
        if (!room) {
            throw new Error('Room not found');
        }

        // Check if room has active tenants
        const activeTenants = await db.Tenant.count({
            where: { roomId: id, status: 'Active' }
        });

        if (activeTenants > 0) {
            throw new Error('Cannot delete room with active tenants');
        }

        await room.destroy();
        return true;
    } catch (error) {
        throw new Error(`Failed to delete room: ${error.message}`);
    }
}

// Update room status
async function updateRoomStatus(id, status) {
    try {
        const room = await db.Room.findByPk(id);
        if (!room) return null;

        // Validate status transition
        if (status === 'Maintenance' && room.occupiedBeds > 0) {
            throw new Error('Cannot set room to maintenance with active tenants');
        }

        await room.update({ status });
        return room;
    } catch (error) {
        throw new Error(`Failed to update room status: ${error.message}`);
    }
}

// Set maintenance mode
async function setMaintenanceMode(id, maintenance, reason) {
    try {
        const room = await db.Room.findByPk(id);
        if (!room) return null;

        if (maintenance) {
            if (room.occupiedBeds > 0) {
                throw new Error('Cannot set room to maintenance with active tenants');
            }
            await room.update({ 
                status: 'Maintenance',
                description: reason ? `${room.description} - MAINTENANCE: ${reason}` : room.description
            });
        } else {
            await room.update({ status: 'Available' });
        }

        return room;
    } catch (error) {
        throw new Error(`Failed to set maintenance mode: ${error.message}`);
    }
}

// Add tenant to room
async function addTenantToRoom(roomId, accountId, bedNumber, tenantData) {
    try {
        const room = await db.Room.findByPk(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        // Validate bed number
        if (bedNumber < 1 || bedNumber > 4) {
            throw new Error('Bed number must be between 1 and 4');
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
            throw new Error(`Bed ${bedNumber} is already occupied`);
        }

        // Check if room has available beds
        if (room.occupiedBeds >= room.totalBeds) {
            throw new Error('Room is fully occupied');
        }

        // Check if account exists
        const account = await db.Account.findByPk(accountId);
        if (!account) {
            throw new Error('Account not found');
        }

        // Create tenant
        const tenant = await db.Tenant.create({
            accountId,
            roomId,
            bedNumber,
            monthlyRent: tenantData.monthlyRent || room.monthlyRent / 4,
            utilities: tenantData.utilities || room.utilities / 4,
            deposit: tenantData.deposit || 0,
            emergencyContact: tenantData.emergencyContact || {},
            specialRequirements: tenantData.specialRequirements || '',
            status: 'Pending'
        });

        // Update room occupancy
        await room.addTenant();

        // Return tenant with account and room information
        const tenantWithDetails = await db.Tenant.findByPk(tenant.id, {
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'avatar']
                },
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'roomNumber', 'floor', 'building']
                }
            ]
        });

        return {
            tenant: tenantWithDetails,
            room: room,
            message: `Tenant added to bed ${bedNumber} successfully`
        };
    } catch (error) {
        throw new Error(`Failed to add tenant to room: ${error.message}`);
    }
}

// Remove tenant from room
async function removeTenantFromRoom(roomId, tenantId) {
    try {
        const tenant = await db.Tenant.findByPk(tenantId);
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        if (tenant.roomId !== parseInt(roomId)) {
            throw new Error('Tenant does not belong to this room');
        }

        // Check out tenant
        await tenant.checkOut();

        // Update room occupancy
        const room = await db.Room.findByPk(roomId);
        if (room) {
            await room.removeTenant();
        }

        return {
            message: 'Tenant removed from room successfully',
            tenant: tenant
        };
    } catch (error) {
        throw new Error(`Failed to remove tenant from room: ${error.message}`);
    }
}

// Get room tenants
async function getRoomTenants(roomId) {
    try {
        const tenants = await db.Tenant.findAll({
            where: { roomId },
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ],
            order: [['bedNumber', 'ASC']]
        });

        return tenants;
    } catch (error) {
        throw new Error(`Failed to get room tenants: ${error.message}`);
    }
}

// Get room bed status
async function getRoomBedStatus(roomId) {
    try {
        const room = await db.Room.findByPk(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        const tenants = await db.Tenant.findAll({
            where: { roomId },
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                }
            ],
            order: [['bedNumber', 'ASC']]
        });

        // Create bed status array
        const bedStatus = [];
        for (let bedNum = 1; bedNum <= 4; bedNum++) {
            const tenant = tenants.find(t => t.bedNumber === bedNum && t.status === 'Active');
            bedStatus.push({
                bedNumber: bedNum,
                status: tenant ? 'Occupied' : 'Available',
                tenant: tenant ? {
                    id: tenant.id,
                    firstName: tenant.account.firstName,
                    lastName: tenant.account.lastName,
                    email: tenant.account.email,
                    avatar: tenant.account.avatar,
                    checkInDate: tenant.checkInDate,
                    monthlyRent: tenant.monthlyRent,
                    utilities: tenant.utilities
                } : null
            });
        }

        return {
            room: {
                id: room.id,
                roomNumber: room.roomNumber,
                floor: room.floor,
                building: room.building,
                status: room.status,
                totalBeds: room.totalBeds,
                occupiedBeds: room.occupiedBeds,
                availableBeds: room.availableBeds,
                occupancyRate: room.occupancyRate
            },
            bedStatus
        };
    } catch (error) {
        throw new Error(`Failed to get room bed status: ${error.message}`);
    }
}
