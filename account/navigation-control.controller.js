const navigationControlService = require('./navigation-control.service');
const { requireHeadAdmin } = require('./headadmin.middleware');

module.exports = {
    // Simplified Admin Management (Navigation Control Only)
    getAllAdmins,
    createAdmin,
    updateAdminNavigationPermissions,
    deactivateAdmin,
    deleteAdmin,
    
    // Navigation Permission Management
    getNavigationPermissions,
    updateNavigationAccess
};

// ================= SIMPLIFIED ADMIN MANAGEMENT =================

async function getAllAdmins(req, res, next) {
    try {
        const admins = await navigationControlService.getAllAdmins();
        
        // Transform data for frontend
        const transformedAdmins = admins.map(admin => ({
            id: admin.id,
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email,
            role: admin.role,
            status: admin.status,
            created: admin.created,
            updated: admin.updated,
            permissions: admin.permissions || []
        }));
        
        res.json(transformedAdmins);
    } catch (error) {
        next(error);
    }
}

async function createAdmin(req, res, next) {
    try {
        const { firstName, lastName, email, password } = req.body;
        
        // Create the admin account
        const admin = await navigationControlService.createAdmin({
            firstName,
            lastName,
            email,
            password
        });
        
        res.status(201).json({
            message: 'Admin created successfully',
            admin: {
                id: admin.id,
                firstName: admin.firstName,
                lastName: admin.lastName,
                email: admin.email,
                role: admin.role,
                status: admin.status
            }
        });
    } catch (error) {
        next(error);
    }
}

async function updateAdminNavigationPermissions(req, res, next) {
    try {
        const { adminId } = req.params;
        const { permissions } = req.body;
        
        await navigationControlService.updateAdminNavigationPermissions(adminId, permissions, req.user.id);
        
        res.json({ message: 'Admin navigation permissions updated successfully' });
    } catch (error) {
        next(error);
    }
}

async function deactivateAdmin(req, res, next) {
    try {
        const { adminId } = req.params;
        
        const admin = await navigationControlService.deactivateAdmin(adminId);
        
        res.json({ 
            message: 'Admin deactivated successfully',
            admin: {
                id: admin.id,
                status: admin.status
            }
        });
    } catch (error) {
        next(error);
    }
}

async function deleteAdmin(req, res, next) {
    try {
        const { adminId } = req.params;
        
        const admin = await navigationControlService.deleteAdmin(adminId);
        
        res.json({ 
            message: 'Admin deleted successfully',
            admin: {
                id: admin.id,
                status: admin.status
            }
        });
    } catch (error) {
        next(error);
    }
}

// ================= NAVIGATION PERMISSION MANAGEMENT =================

async function getNavigationPermissions(req, res, next) {
    try {
        const permissions = await navigationControlService.getNavigationPermissions();
        res.json(permissions);
    } catch (error) {
        next(error);
    }
}

async function updateNavigationAccess(req, res, next) {
    try {
        const { adminId } = req.params;
        const { navigationItems } = req.body;
        
        const result = await navigationControlService.updateNavigationAccess(adminId, navigationItems);
        
        res.json(result);
    } catch (error) {
        next(error);
    }
}
