const config = require('../config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../_helpers/db');
const notificationHelper = require('../notifications/notification.helper');

// ================= AUTH =================

async function authenticate({ email, password, ipAddress }) {
    const account = await db.Account.scope('withHash').findOne({ where: { email } });

    if (!account) {
        throw 'Account not found. Please check your email address.';
    }

    if (!bcrypt.compareSync(password, account.passwordHash)) {
        throw 'Wrong credentials. Please check your password.';
    }

    if (account.status === 'Pending') {
        throw 'Account pending approval. Please wait for superadmin approval.';
    }

    if (account.status === 'Suspended') {
        throw 'Account suspended. Please contact support for assistance.';
    }

    if (account.status === 'Rejected') {
        throw 'Account rejected. Please contact support for more information.';
    }

    if (account.status === 'Deleted') {
        throw 'Account deleted. Please contact support for assistance.';
    }

    if (account.status !== 'Active') {
        throw 'Account not active. Please contact support.';
    }

    // authentication successful
    const jwtToken = generateJwtToken(account);
    const refreshToken = await generateRefreshToken(account, ipAddress);

    // return basic details and tokens
    const basicAccountDetails = await basicDetails(account);
    return {
        ...basicAccountDetails,
        jwtToken,
        refreshToken: refreshToken.token
    };
}

async function refreshToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);
    const { account } = refreshToken;

    // replace old refresh token with a new one and save
    const newRefreshToken = await generateRefreshToken(account, ipAddress);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();

    // generate new jwt
    const jwtToken = generateJwtToken(account);

    // return basic details and tokens
    const basicAccountDetails = await basicDetails(account);
    return {
        ...basicAccountDetails,
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}
async function revokeToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);

    // revoke token and save
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    await refreshToken.save();
}




async function getAll() { 
    return await db.Account.findAll();
}

async function getById(id) {
    return await getAccount(id);
}

async function create(params) {
    // validate
    if (await db.Account.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already registered';
    }

    // default title when role is Accounting and title is missing/empty
    if (params && params.role === 'Accounting' && (!params.title || params.title.trim() === '')) {
        params.title = 'accounting';
    }

    const account = new db.Account(params);

    // hash password
    if (params.password) {
        account.passwordHash = bcrypt.hashSync(params.password, 10);
    }

    // save
    await account.save();
    
    // Send notification
    try {
        await notificationHelper.notifyAccountCreated(account);
    } catch (e) {
        console.warn('Failed to send account creation notification:', e.message);
    }
    
    return basicDetails(account);
}

async function update(id, params) {
    const account = await getAccount(id);

    // validate (email)
    if (params.email && account.email !== params.email) {
        if (await db.Account.findOne({ where: { email: params.email } })) {
            throw 'Email "' + params.email + '" is already registered';
        }
    }

    // hash password if entered
    if (params.password) {
        params.passwordHash = bcrypt.hashSync(params.password, 10);
    }

    Object.assign(account, params);
    account.updated = Date.now();
    await account.save();

    return basicDetails(account);
}

async function _delete(id) {
    const account = await getAccount(id);
    await account.destroy();
}

// ================= SuperAdmin Management =================

async function getPending() {
    return await db.Account.findAll({ where: { status: 'Pending' } });
}

async function approveAccount(id) {
    const account = await getAccount(id);
    account.status = 'Active';
    account.updated = Date.now();
    await account.save();
    
    // Send notification
    try {
        await notificationHelper.notifyAccountApproved(account);
    } catch (e) {
        console.warn('Failed to send approval notification:', e.message);
    }
    
    return basicDetails(account);
}

async function rejectAccount(id, reason) {
    const account = await getAccount(id);
    account.status = 'Rejected';
    account.updated = Date.now();
    await account.save();
    
    // Send notification
    try {
        await notificationHelper.notifyAccountRejected(account, reason);
    } catch (e) {
        console.warn('Failed to send rejection notification:', e.message);
    }
    
    return { ...basicDetails(account), rejectionReason: reason || null };
}

async function setRole(id, role) {
    const allowedRoles = ['HeadAdmin', 'Admin', 'SuperAdmin', 'Tenant', 'Accounting'];
    if (!allowedRoles.includes(role)) {
        throw 'Invalid role';
    }
    const account = await getAccount(id);
    account.role = role;
    account.updated = Date.now();
    await account.save();
    return basicDetails(account);
}

async function setStatus(id, status) {
    const allowedStatuses = ['Active', 'Pending', 'Suspended', 'Deleted', 'Rejected'];
    if (!allowedStatuses.includes(status)) {
        throw 'Invalid status';
    }
    const account = await getAccount(id);
    const oldStatus = account.status;
    account.status = status;
    account.updated = Date.now();
    await account.save();
    
    // Send notification if status changed
    try {
        if (oldStatus !== status) {
            await notificationHelper.notifyAccountStatusChanged(account, oldStatus, status);
        }
    } catch (e) {
        console.warn('Failed to send status change notification:', e.message);
    }
    
    return basicDetails(account);
}

// ================= HELPER FUNCTIONS =================

function generateJwtToken(account) {
    // create a jwt token valid for 15 minutes
    return jwt.sign({ id: account.id, role: account.role }, config.secret, { expiresIn: '1h' });
}

async function generateRefreshToken(account, ipAddress) {
    return await db.RefreshToken.create({
        accountId: account.id,
        token: crypto.randomBytes(40).toString('hex'),
        expires: new Date(Date.now() + 7*24*60*60*1000), // 7 days
        createdByIp: ipAddress
    });
}

async function getRefreshToken(token) {
    // FIX: Use db.RefreshToken and db.Account directly
    const refreshToken = await db.RefreshToken.findOne({ where: { token }, include: 'Account' });
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}
async function getAccount(id) {
    const account = await db.Account.findByPk(id);
    if (!account) throw 'Account not found';
    return account;
}

async function basicDetails(account) {
    const { id, role, status, firstName, lastName, email } = account;
    
    // For now, use the account's role field directly and create a simple roles array
    // This avoids the association issues while still providing the necessary data
    const roles = role ? [{ 
        id: 0, 
        name: role, 
        level: getRoleLevel(role) 
    }] : [];
    
    // Get basic permissions based on role
    let permissions = getRolePermissions(role);
    
    // Check for custom navigation permissions (for Admin role)
    if (role === 'Admin') {
        try {
            const navigationPermission = await db.NavigationPermission.findOne({
                where: { accountId: id }
            });
            
            if (navigationPermission && navigationPermission.permissions) {
                const customPermissions = JSON.parse(navigationPermission.permissions);
                // Convert custom permission IDs to permission objects
                permissions = customPermissions.map(permId => {
                    const navPerm = getRolePermissions('Admin').find(p => p.id === permId);
                    return navPerm || { id: permId, name: `nav.${permId}`, resource: 'navigation', action: permId };
                });
            }
        } catch (error) {
            console.log('Error loading custom navigation permissions:', error.message);
        }
    }
    
    return { 
        id, 
        role, 
        status, 
        firstName, 
        lastName, 
        email,
        roles: roles,
        permissions: permissions
    };
}

// Helper function to get role level
function getRoleLevel(roleName) {
    const roleLevels = {
        'HeadAdmin': 100,
        'SuperAdmin': 90,
        'Admin': 50,
        'Accounting': 30,
        'Tenant': 10
    };
    return roleLevels[roleName] || 0;
}

// Helper function to get role permissions
function getRolePermissions(roleName) {
    const rolePermissions = {
        'HeadAdmin': [
            { id: 1, name: 'manage_users', resource: 'user_management', action: 'manage' },
            { id: 2, name: 'view_dashboard', resource: 'dashboard', action: 'read' },
            { id: 3, name: 'manage_rooms', resource: 'rooms', action: 'manage' },
            { id: 4, name: 'view_rooms', resource: 'rooms', action: 'read' },
            { id: 5, name: 'manage_tenants', resource: 'tenants', action: 'manage' },
            { id: 6, name: 'view_tenants', resource: 'tenants', action: 'read' },
            { id: 7, name: 'manage_payments', resource: 'payments', action: 'manage' },
            { id: 8, name: 'view_payments', resource: 'payments', action: 'read' },
            { id: 9, name: 'manage_maintenance', resource: 'maintenance', action: 'manage' },
            { id: 10, name: 'view_maintenance', resource: 'maintenance', action: 'read' },
            { id: 11, name: 'manage_announcements', resource: 'announcements', action: 'manage' },
            { id: 12, name: 'view_announcements', resource: 'announcements', action: 'read' },
            { id: 13, name: 'view_archives', resource: 'archives', action: 'read' },
            { id: 14, name: 'manage_roles', resource: 'roles', action: 'manage' },
            { id: 15, name: 'manage_permissions', resource: 'permissions', action: 'manage' },
            { id: 16, name: 'view_accounting', resource: 'accounting', action: 'read' },
            { id: 17, name: 'manage_admins', resource: 'admin_management', action: 'manage' },
            // Navigation permissions
            { id: 18, name: 'nav.dashboard', resource: 'navigation', action: 'dashboard' },
            { id: 19, name: 'nav.rooms', resource: 'navigation', action: 'rooms' },
            { id: 20, name: 'nav.tenants', resource: 'navigation', action: 'tenants' },
            { id: 21, name: 'nav.accounting', resource: 'navigation', action: 'accounting' },
            { id: 22, name: 'nav.pricing', resource: 'navigation', action: 'pricing' },
            { id: 23, name: 'nav.maintenance', resource: 'navigation', action: 'maintenance' },
            { id: 24, name: 'nav.announcements', resource: 'navigation', action: 'announcements' },
            { id: 25, name: 'nav.archives', resource: 'navigation', action: 'archives' },
            { id: 26, name: 'nav.add_account', resource: 'navigation', action: 'add_account' }
        ],
        'SuperAdmin': [
            { id: 2, name: 'view_dashboard', resource: 'dashboard', action: 'read' },
            { id: 3, name: 'manage_rooms', resource: 'rooms', action: 'manage' },
            { id: 4, name: 'view_rooms', resource: 'rooms', action: 'read' },
            { id: 5, name: 'manage_tenants', resource: 'tenants', action: 'manage' },
            { id: 6, name: 'view_tenants', resource: 'tenants', action: 'read' },
            { id: 7, name: 'manage_payments', resource: 'payments', action: 'manage' },
            { id: 8, name: 'view_payments', resource: 'payments', action: 'read' },
            { id: 9, name: 'manage_maintenance', resource: 'maintenance', action: 'manage' },
            { id: 10, name: 'view_maintenance', resource: 'maintenance', action: 'read' },
            { id: 11, name: 'manage_announcements', resource: 'announcements', action: 'manage' },
            { id: 12, name: 'view_announcements', resource: 'announcements', action: 'read' },
            { id: 13, name: 'view_archives', resource: 'archives', action: 'read' },
            { id: 16, name: 'view_accounting', resource: 'accounting', action: 'read' },
            // Navigation permissions
            { id: 18, name: 'nav.dashboard', resource: 'navigation', action: 'dashboard' },
            { id: 19, name: 'nav.rooms', resource: 'navigation', action: 'rooms' },
            { id: 20, name: 'nav.tenants', resource: 'navigation', action: 'tenants' },
            { id: 21, name: 'nav.accounting', resource: 'navigation', action: 'accounting' },
            { id: 22, name: 'nav.pricing', resource: 'navigation', action: 'pricing' },
            { id: 23, name: 'nav.maintenance', resource: 'navigation', action: 'maintenance' },
            { id: 24, name: 'nav.announcements', resource: 'navigation', action: 'announcements' },
            { id: 25, name: 'nav.archives', resource: 'navigation', action: 'archives' },
            { id: 26, name: 'nav.add_account', resource: 'navigation', action: 'add_account' }
        ],
        'Admin': [
            { id: 2, name: 'view_dashboard', resource: 'dashboard', action: 'read' },
            { id: 4, name: 'view_rooms', resource: 'rooms', action: 'read' },
            { id: 6, name: 'view_tenants', resource: 'tenants', action: 'read' },
            { id: 10, name: 'view_maintenance', resource: 'maintenance', action: 'read' },
            { id: 12, name: 'view_announcements', resource: 'announcements', action: 'read' },
            { id: 13, name: 'view_archives', resource: 'archives', action: 'read' },
            // Navigation permissions - Admin has limited navigation by default
            { id: 'dashboard', name: 'nav.dashboard', resource: 'navigation', action: 'dashboard' },
            { id: 'rooms', name: 'nav.rooms', resource: 'navigation', action: 'rooms' },
            { id: 'tenants', name: 'nav.tenants', resource: 'navigation', action: 'tenants' },
            { id: 'maintenance', name: 'nav.maintenance', resource: 'navigation', action: 'maintenance' },
            { id: 'announcements', name: 'nav.announcements', resource: 'navigation', action: 'announcements' },
            { id: 'archives', name: 'nav.archives', resource: 'navigation', action: 'archives' }
        ],
        'Accounting': [
            { id: 2, name: 'view_dashboard', resource: 'dashboard', action: 'read' },
            { id: 6, name: 'view_tenants', resource: 'tenants', action: 'read' },
            { id: 7, name: 'manage_payments', resource: 'payments', action: 'manage' },
            { id: 8, name: 'view_payments', resource: 'payments', action: 'read' },
            { id: 16, name: 'view_accounting', resource: 'accounting', action: 'read' },
            // Navigation permissions
            { id: 18, name: 'nav.dashboard', resource: 'navigation', action: 'dashboard' },
            { id: 20, name: 'nav.tenants', resource: 'navigation', action: 'tenants' },
            { id: 21, name: 'nav.accounting', resource: 'navigation', action: 'accounting' }
        ],
        'Tenant': [
            { id: 2, name: 'view_dashboard', resource: 'dashboard', action: 'read' },
            { id: 10, name: 'view_maintenance', resource: 'maintenance', action: 'read' },
            { id: 8, name: 'view_payments', resource: 'payments', action: 'read' },
            // Navigation permissions
            { id: 18, name: 'nav.dashboard', resource: 'navigation', action: 'dashboard' },
            { id: 23, name: 'nav.maintenance', resource: 'navigation', action: 'maintenance' }
        ]
    };
    
    return rolePermissions[roleName] || [];
}

module.exports = {
    authenticate,
    refreshToken,
    revokeToken,
    getAll,
    getById,
    create,
    update,
    delete: _delete,
    getPending,
    approveAccount,
    rejectAccount,
    setRole,
    setStatus,
    basicDetails
};
