const rbacService = require('./rbac.service');
const accountService = require('./account.service');
const { requireHeadAdmin } = require('./rbac.middleware');

module.exports = {
    // Admin management endpoints
    getAllAdmins,
    createAdmin,
    updateAdminPermissions,
    deactivateAdmin,
    deleteAdmin,
    
    // Role and permission management
    getAllRoles,
    getAllPermissions,
    getAccountRoles,
    getAccountPermissions,
    assignRoleToAccount,
    removeRoleFromAccount,
    grantPermission,
    revokePermission,
    
    // Permission checking
    checkPermission,
    getEffectivePermissions
};

// ================= ADMIN MANAGEMENT =================

async function getAllAdmins(req, res, next) {
    try {
        const admins = await rbacService.getAllAdmins();
        
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
            roles: admin.accountRoles?.map(ar => ({
                id: ar.role.id,
                name: ar.role.name,
                level: ar.role.level,
                assignedAt: ar.assignedAt
            })) || [],
            permissions: admin.accountPermissions?.map(ap => ({
                id: ap.permission.id,
                name: ap.permission.name,
                resource: ap.permission.resource,
                action: ap.permission.action,
                grantedAt: ap.grantedAt
            })) || []
        }));
        
        res.json(transformedAdmins);
    } catch (error) {
        next(error);
    }
}

async function createAdmin(req, res, next) {
    try {
        const { firstName, lastName, email, password, permissions = [] } = req.body;
        
        // Create the admin account
        const admin = await rbacService.createAdmin({
            firstName,
            lastName,
            email,
            password
        });
        
        // Grant specified permissions
        if (permissions.length > 0) {
            await rbacService.updateAdminPermissions(admin.id, permissions, req.user.id);
        }
        
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

async function updateAdminPermissions(req, res, next) {
    try {
        const { adminId } = req.params;
        const { permissions } = req.body;
        
        // Check if current user can manage this admin
        const canManage = await rbacService.canManageAccount(req.user.id, adminId);
        if (!canManage) {
            return res.status(403).json({ message: 'Cannot manage this admin account' });
        }
        
        await rbacService.updateAdminPermissions(adminId, permissions, req.user.id);
        
        res.json({ message: 'Admin permissions updated successfully' });
    } catch (error) {
        next(error);
    }
}

async function deactivateAdmin(req, res, next) {
    try {
        const { adminId } = req.params;
        
        // Check if current user can manage this admin
        const canManage = await rbacService.canManageAccount(req.user.id, adminId);
        if (!canManage) {
            return res.status(403).json({ message: 'Cannot manage this admin account' });
        }
        
        const admin = await rbacService.deactivateAdmin(adminId);
        
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
        
        // Check if current user can manage this admin
        const canManage = await rbacService.canManageAccount(req.user.id, adminId);
        if (!canManage) {
            return res.status(403).json({ message: 'Cannot manage this admin account' });
        }
        
        const admin = await rbacService.deleteAdmin(adminId);
        
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

// ================= ROLE AND PERMISSION MANAGEMENT =================

async function getAllRoles(req, res, next) {
    try {
        const roles = await rbacService.getAllRoles();
        res.json(roles);
    } catch (error) {
        next(error);
    }
}

async function getAllPermissions(req, res, next) {
    try {
        const permissions = await rbacService.getAllPermissions();
        res.json(permissions);
    } catch (error) {
        next(error);
    }
}

async function getAccountRoles(req, res, next) {
    try {
        const { accountId } = req.params;
        const roles = await rbacService.getAccountRoles(accountId);
        res.json(roles);
    } catch (error) {
        next(error);
    }
}

async function getAccountPermissions(req, res, next) {
    try {
        const { accountId } = req.params;
        const permissions = await rbacService.getAccountPermissions(accountId);
        res.json(permissions);
    } catch (error) {
        next(error);
    }
}

async function assignRoleToAccount(req, res, next) {
    try {
        const { accountId, roleId } = req.body;
        
        // Check if current user can manage this account
        const canManage = await rbacService.canManageAccount(req.user.id, accountId);
        if (!canManage) {
            return res.status(403).json({ message: 'Cannot manage this account' });
        }
        
        const accountRole = await rbacService.assignRoleToAccount(accountId, roleId, req.user.id);
        
        res.json({ 
            message: 'Role assigned successfully',
            accountRole
        });
    } catch (error) {
        next(error);
    }
}

async function removeRoleFromAccount(req, res, next) {
    try {
        const { accountId, roleId } = req.body;
        
        // Check if current user can manage this account
        const canManage = await rbacService.canManageAccount(req.user.id, accountId);
        if (!canManage) {
            return res.status(403).json({ message: 'Cannot manage this account' });
        }
        
        const accountRole = await rbacService.removeRoleFromAccount(accountId, roleId);
        
        res.json({ 
            message: 'Role removed successfully',
            accountRole
        });
    } catch (error) {
        next(error);
    }
}

async function grantPermission(req, res, next) {
    try {
        const { accountId, permissionId } = req.body;
        
        // Check if current user can manage this account
        const canManage = await rbacService.canManageAccount(req.user.id, accountId);
        if (!canManage) {
            return res.status(403).json({ message: 'Cannot manage this account' });
        }
        
        const accountPermission = await rbacService.grantPermission(accountId, permissionId, req.user.id);
        
        res.json({ 
            message: 'Permission granted successfully',
            accountPermission
        });
    } catch (error) {
        next(error);
    }
}

async function revokePermission(req, res, next) {
    try {
        const { accountId, permissionId } = req.body;
        
        // Check if current user can manage this account
        const canManage = await rbacService.canManageAccount(req.user.id, accountId);
        if (!canManage) {
            return res.status(403).json({ message: 'Cannot manage this account' });
        }
        
        const accountPermission = await rbacService.revokePermission(accountId, permissionId);
        
        res.json({ 
            message: 'Permission revoked successfully',
            accountPermission
        });
    } catch (error) {
        next(error);
    }
}

// ================= PERMISSION CHECKING =================

async function checkPermission(req, res, next) {
    try {
        const { resource, action } = req.query;
        const accountId = req.user.id;
        
        const hasPermission = await rbacService.hasPermission(accountId, resource, action);
        
        res.json({ 
            hasPermission,
            resource,
            action
        });
    } catch (error) {
        next(error);
    }
}

async function getEffectivePermissions(req, res, next) {
    try {
        const { accountId } = req.params;
        const permissions = await rbacService.getAccountEffectivePermissions(accountId);
        
        res.json({ permissions });
    } catch (error) {
        next(error);
    }
}
