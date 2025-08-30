const express = require('express');
const router = express.Router();
const roomService = require('./room.service');
const authorize = require('../_middleware/authorize');

// Public routes
router.get('/stats', getRoomStats);
router.get('/available', getAvailableRooms);

//auth routes
router.get('/', ...authorize(), getAllRooms);
router.get('/:id', ...authorize(), getRoomById);
router.post('/', ...authorize(['Admin', 'SuperAdmin']), createRoom);
router.put('/:id', ...authorize(['Admin', 'SuperAdmin']), updateRoom);
router.delete('/:id', ...authorize(['Admin', 'SuperAdmin']), deleteRoom);

// Room status management
router.patch('/:id/status', ...authorize(['Admin', 'SuperAdmin', 'User']), updateRoomStatus);
router.patch('/:id/maintenance', ...authorize(['Admin', 'SuperAdmin']), setMaintenanceMode);

// Room pricing management
router.patch('/:id/pricing', ...authorize(['Admin', 'SuperAdmin']), updateRoomPricing);

// Tenant management
router.post('/:id/tenants', ...authorize(['Admin', 'SuperAdmin']), addTenantToRoom);
router.delete('/:id/tenants/:tenantId', ...authorize(['Admin', 'SuperAdmin']), removeTenantFromRoom);
router.get('/:id/tenants', ...authorize(), getRoomTenants);
router.get('/:id/beds', ...authorize(), getRoomBedStatus);

module.exports = router;

// Controller functions
async function getAllRooms(req, res, next) {
    try {
        const { floor } = req.query;
        const rooms = await roomService.getAllRooms(floor);
        res.json(rooms);
    } catch (error) {
        next(error);
    }
}

async function getRoomById(req, res, next) {
    try {
        const room = await roomService.getRoomById(req.params.id);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json(room);
    } catch (error) {
        next(error);
    }
}

async function getAvailableRooms(req, res, next) {
    try {
        const rooms = await roomService.getAvailableRooms();
        res.json(rooms);
    } catch (error) {
        next(error);
    }
}

async function getRoomStats(req, res, next) {
    try {
        const stats = await roomService.getRoomStats();
        res.json(stats);
    } catch (error) {
        next(error);
    }
}

async function createRoom(req, res, next) {
    try {
        const room = await roomService.createRoom(req.body);
        res.status(201).json(room);
    } catch (error) {
        next(error);
    }
}

async function updateRoom(req, res, next) {
    try {
        const room = await roomService.updateRoom(req.params.id, req.body);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json(room);
    } catch (error) {
        next(error);
    }
}

async function deleteRoom(req, res, next) {
    try {
        await roomService.deleteRoom(req.params.id);
        res.json({ message: 'Room deleted successfully' });
    } catch (error) {
        next(error);
    }
}

async function updateRoomStatus(req, res, next) {
    try {
        const { status } = req.body;
        const room = await roomService.updateRoomStatus(req.params.id, status);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json(room);
    } catch (error) {
        next(error);
    }
}

async function setMaintenanceMode(req, res, next) {
    try {
        const { maintenance, reason } = req.body;
        const room = await roomService.setMaintenanceMode(req.params.id, maintenance, reason);
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json(room);
    } catch (error) {
        next(error);
    }
}

async function updateRoomPricing(req, res, next) {
    try {
        const { monthlyRent, utilities } = req.body;
        const room = await roomService.updateRoomPricing(req.params.id, { monthlyRent, utilities });
        if (!room) {
            return res.status(404).json({ message: 'Room not found' });
        }
        res.json(room);
    } catch (error) {
        next(error);
    }
}

async function addTenantToRoom(req, res, next) {
    try {
        const { accountId, bedNumber, monthlyRent, utilities, deposit, emergencyContact, specialRequirements } = req.body;
        const result = await roomService.addTenantToRoom(
            req.params.id, 
            accountId, 
            bedNumber, 
            { monthlyRent, utilities, deposit, emergencyContact, specialRequirements }
        );
        res.json(result);
    } catch (error) {
        next(error);
    }
}

async function removeTenantFromRoom(req, res, next) {
    try {
        const result = await roomService.removeTenantFromRoom(req.params.id, req.params.tenantId);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

async function getRoomTenants(req, res, next) {
    try {
        const tenants = await roomService.getRoomTenants(req.params.id);
        res.json(tenants);
    } catch (error) {
        next(error);
    }
}

async function getRoomBedStatus(req, res, next) {
    try {
        const bedStatus = await roomService.getRoomBedStatus(req.params.id);
        res.json(bedStatus);
    } catch (error) {
        next(error);
    }
}
