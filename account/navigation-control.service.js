const db = require('../_helpers/db');
const { Op } = require('sequelize');

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

async function getAllAdmins() {
    try {
        const admins = await db.Account.findAll({
            where: {
                role: {
                    [Op.in]: ['HeadAdmin', 'SuperAdmin', 'Admin']
                }
            },
            include: [{
                model: db.NavigationPermission,
                as: 'navigationPermissions',
                required: false
            }],
            order: [['created', 'DESC']]
        });
        
        // Transform the data to include navigation permissions
        return admins.map(admin => {
            let permissions = getNavigationPermissionsForRole(admin.role);
            
            // If admin has custom navigation permissions, use those
            if (admin.navigationPermissions && admin.navigationPermissions.length > 0) {
                try {
                    const customPermissions = JSON.parse(admin.navigationPermissions[0].permissions);
                    permissions = customPermissions.map(permId => {
                        const navPerm = getNavigationPermissionsForRole('Admin').find(p => p.id === permId);
                        return navPerm || { id: permId, name: 'Unknown', resource: 'navigation', action: permId };
                    });
                } catch (error) {
                    console.log('Error parsing navigation permissions:', error);
                }
            }
            
            return {
                ...admin.toJSON(),
                permissions: permissions
            };
        });
    } catch (error) {
        console.log('Error in getAllAdmins:', error.message);
        return [];
    }
}

async function createAdmin(params) {
    // Validate email uniqueness
    if (await db.Account.findOne({ where: { email: params.email } })) {
        throw 'Email already registered';
    }
    
    const account = new db.Account({
        ...params,
        role: 'Admin',
        status: 'Active'
    });
    
    // Hash password
    if (params.password) {
        const bcrypt = require('bcryptjs');
        account.passwordHash = bcrypt.hashSync(params.password, 10);
    }
    
    await account.save();
    
    return account;
}

async function updateAdminNavigationPermissions(adminId, navigationPermissions, updatedBy) {
    try {
        console.log('🔧 Service: updateAdminNavigationPermissions called');
        console.log('🔧 Service: adminId:', adminId);
        console.log('🔧 Service: navigationPermissions:', navigationPermissions);
        console.log('🔧 Service: updatedBy:', updatedBy);
        
        // Get the admin account
        const admin = await db.Account.findByPk(adminId);
        if (!admin) {
            console.log('❌ Service: Admin account not found for ID:', adminId);
            throw 'Admin account not found';
        }
        
        console.log('✅ Service: Found admin account:', admin.email, admin.role);
        
        // Remove existing navigation permissions
        const deletedCount = await db.NavigationPermission.destroy({
            where: { accountId: adminId }
        });
        console.log('🗑️ Service: Deleted', deletedCount, 'existing navigation permissions');
        
        // Create new navigation permission record with JSON string
        const newPermission = await db.NavigationPermission.create({
            accountId: adminId,
            permissions: JSON.stringify(navigationPermissions),
            createdBy: updatedBy,
            updatedBy: updatedBy
        });
        
        console.log('✅ Service: Created new navigation permission record:', newPermission.id);
        console.log('✅ Service: Permissions saved as JSON:', JSON.stringify(navigationPermissions));
        
        return true;
    } catch (error) {
        console.error('❌ Service: Error in updateAdminNavigationPermissions:', error.message);
        throw error;
    }
}

async function deactivateAdmin(adminId) {
    const account = await db.Account.findByPk(adminId);
    if (!account) throw 'Account not found';
    
    account.status = 'Suspended';
    account.updated = Date.now();
    await account.save();
    
    return account;
}

async function deleteAdmin(adminId) {
    const account = await db.Account.findByPk(adminId);
    if (!account) throw 'Account not found';
    
    // Prevent deletion of Head Admin
    if (account.role === 'HeadAdmin') {
        throw 'Cannot delete Head Admin account';
    }
    
    account.status = 'Deleted';
    account.updated = Date.now();
    await account.save();
    
    return account;
}

// ================= NAVIGATION PERMISSION MANAGEMENT =================

async function getNavigationPermissions() {
    // Return the standard navigation items that can be controlled
    return [
        { id: 'dashboard', name: 'Dashboard', resource: 'navigation', action: 'dashboard', description: 'Access Dashboard navigation' },
        { id: 'rooms', name: 'Rooms', resource: 'navigation', action: 'rooms', description: 'Access Rooms navigation' },
        { id: 'tenants', name: 'Tenants', resource: 'navigation', action: 'tenants', description: 'Access Tenants navigation' },
        { id: 'accounting', name: 'Accounting View', resource: 'navigation', action: 'accounting', description: 'Access Accounting View navigation' },
        { id: 'overdue_payments', name: 'Overdue Payments', resource: 'navigation', action: 'overdue_payments', description: 'Access Overdue Payments navigation' },
        { id: 'pricing', name: 'Pricing', resource: 'navigation', action: 'pricing', description: 'Access Pricing navigation' },
        { id: 'maintenance', name: 'Maintenance', resource: 'navigation', action: 'maintenance', description: 'Access Maintenance navigation' },
        { id: 'announcements', name: 'Announcements', resource: 'navigation', action: 'announcements', description: 'Access Announcements navigation' },
        { id: 'archives', name: 'Archives', resource: 'navigation', action: 'archives', description: 'Access Archives navigation' },
        { id: 'add_account', name: 'Add Account', resource: 'navigation', action: 'add_account', description: 'Access Add Account navigation' }
    ];
}

async function updateNavigationAccess(adminId, navigationItems) {
    try {
        // Update navigation permissions for the admin
        await updateAdminNavigationPermissions(adminId, navigationItems, null);
        
        return { success: true, message: 'Navigation access updated successfully' };
    } catch (error) {
        console.log('Error in updateNavigationAccess:', error.message);
        throw error;
    }
}

async function getCurrentUserNavigationAccess(userId, userRole) {
    try {
        // Get user's custom navigation permissions if they exist
        const customPermissions = await db.NavigationPermission.findOne({
            where: { accountId: userId }
        });
        
        let navigationAccess = [];
        
        if (customPermissions) {
            // User has custom navigation permissions
            try {
                const permissionIds = JSON.parse(customPermissions.permissions);
                navigationAccess = permissionIds.map(permId => {
                    const navPerm = getNavigationPermissionsForRole('Admin').find(p => p.id === permId);
                    return navPerm || { id: permId, name: 'Unknown', resource: 'navigation', action: permId };
                });
            } catch (error) {
                console.log('Error parsing custom navigation permissions:', error);
                // Fallback to role-based permissions
                navigationAccess = getNavigationPermissionsForRole(userRole);
            }
        } else {
            // Use role-based permissions
            navigationAccess = getNavigationPermissionsForRole(userRole);
        }
        
        return {
            userId,
            userRole,
            navigationAccess,
            hasCustomPermissions: !!customPermissions
        };
    } catch (error) {
        console.log('Error in getCurrentUserNavigationAccess:', error.message);
        throw error;
    }
}

// ================= HELPER FUNCTIONS =================

function getNavigationPermissionsForRole(roleName) {
    // Define default navigation permissions for each role
    const roleNavigationPermissions = {
        'HeadAdmin': [
            { id: 'dashboard', name: 'Dashboard', resource: 'navigation', action: 'dashboard' },
            { id: 'rooms', name: 'Rooms', resource: 'navigation', action: 'rooms' },
            { id: 'tenants', name: 'Tenants', resource: 'navigation', action: 'tenants' },
            { id: 'accounting', name: 'Accounting View', resource: 'navigation', action: 'accounting' },
            { id: 'overdue_payments', name: 'Overdue Payments', resource: 'navigation', action: 'overdue_payments' },
            { id: 'pricing', name: 'Pricing', resource: 'navigation', action: 'pricing' },
            { id: 'maintenance', name: 'Maintenance', resource: 'navigation', action: 'maintenance' },
            { id: 'announcements', name: 'Announcements', resource: 'navigation', action: 'announcements' },
            { id: 'archives', name: 'Archives', resource: 'navigation', action: 'archives' },
            { id: 'add_account', name: 'Add Account', resource: 'navigation', action: 'add_account' },
            { id: 'admin_management', name: 'Admin Management', resource: 'navigation', action: 'admin_management' },
            { id: 'navigation_control', name: 'Navigation Control', resource: 'navigation', action: 'navigation_control' }
        ],
        'SuperAdmin': [
            { id: 'dashboard', name: 'Dashboard', resource: 'navigation', action: 'dashboard' },
            { id: 'rooms', name: 'Rooms', resource: 'navigation', action: 'rooms' },
            { id: 'tenants', name: 'Tenants', resource: 'navigation', action: 'tenants' },
            { id: 'accounting', name: 'Accounting View', resource: 'navigation', action: 'accounting' },
            { id: 'overdue_payments', name: 'Overdue Payments', resource: 'navigation', action: 'overdue_payments' },
            { id: 'pricing', name: 'Pricing', resource: 'navigation', action: 'pricing' },
            { id: 'maintenance', name: 'Maintenance', resource: 'navigation', action: 'maintenance' },
            { id: 'announcements', name: 'Announcements', resource: 'navigation', action: 'announcements' },
            { id: 'archives', name: 'Archives', resource: 'navigation', action: 'archives' },
            { id: 'add_account', name: 'Add Account', resource: 'navigation', action: 'add_account' },
            { id: 'admin_management', name: 'Admin Management', resource: 'navigation', action: 'admin_management' },
            { id: 'navigation_control', name: 'Navigation Control', resource: 'navigation', action: 'navigation_control' }
        ],
        'Admin': [
            { id: 'dashboard', name: 'Dashboard', resource: 'navigation', action: 'dashboard' },
            { id: 'rooms', name: 'Rooms', resource: 'navigation', action: 'rooms' },
            { id: 'tenants', name: 'Tenants', resource: 'navigation', action: 'tenants' },
            { id: 'overdue_payments', name: 'Overdue Payments', resource: 'navigation', action: 'overdue_payments' },
            { id: 'maintenance', name: 'Maintenance', resource: 'navigation', action: 'maintenance' },
            { id: 'announcements', name: 'Announcements', resource: 'navigation', action: 'announcements' },
            { id: 'archives', name: 'Archives', resource: 'navigation', action: 'archives' }
        ],
        'Accounting': [
            { id: 'dashboard', name: 'Dashboard', resource: 'navigation', action: 'dashboard' },
            { id: 'tenants', name: 'Tenants', resource: 'navigation', action: 'tenants' },
            { id: 'accounting', name: 'Accounting View', resource: 'navigation', action: 'accounting' },
            { id: 'overdue_payments', name: 'Overdue Payments', resource: 'navigation', action: 'overdue_payments' }
        ],
        'Tenant': [
            { id: 'dashboard', name: 'Dashboard', resource: 'navigation', action: 'dashboard' },
            { id: 'maintenance', name: 'Maintenance', resource: 'navigation', action: 'maintenance' }
        ]
    };
    
    return roleNavigationPermissions[roleName] || [];
}
