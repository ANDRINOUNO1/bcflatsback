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
    updateNavigationAccess,
    getCurrentUserNavigationAccess
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
        
        console.log('🔧 Navigation Control: Updating permissions for admin:', adminId);
        console.log('🔧 Navigation Control: Request body:', req.body);
        console.log('🔧 Navigation Control: Permissions:', permissions);
        console.log('🔧 Navigation Control: User making request:', req.user.id, req.user.role);
        
        await navigationControlService.updateAdminNavigationPermissions(adminId, permissions, req.user.id);
        
        console.log('✅ Navigation Control: Permissions updated successfully');
        res.json({ message: 'Admin navigation permissions updated successfully' });
    } catch (error) {
        console.error('❌ Navigation Control: Failed to update permissions:', error);
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

async function getCurrentUserNavigationAccess(req, res, next) {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        // Get user's navigation permissions
        const navigationAccess = await navigationControlService.getCurrentUserNavigationAccess(userId, userRole);
        
        res.json(navigationAccess);
    } catch (error) {
        next(error);
    }
}
