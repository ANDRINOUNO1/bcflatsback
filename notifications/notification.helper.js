const notificationService = require('./notification.service');

/**
 * Centralized notification helper for consistent messaging across the application
 */

// Notification Types
const NotificationTypes = {
    PAYMENT: 'PAYMENT',
    ACCOUNT: 'ACCOUNT',
    TENANT: 'TENANT',
    MAINTENANCE: 'MAINTENANCE',
    BILLING: 'BILLING',
    SYSTEM: 'SYSTEM'
};

// Helper to notify multiple roles at once
async function notifyRoles(roles, type, title, message, metadata = {}) {
    try {
        await notificationService.broadcastToRoles({
            roles,
            type,
            title,
            message,
            metadata
        });
    } catch (error) {
        console.error('Failed to send notifications:', error);
    }
}

// Helper to notify specific account
async function notifyAccount(accountId, role, type, title, message, metadata = {}) {
    try {
        await notificationService.createNotification({
            recipientAccountId: accountId,
            recipientRole: role,
            type,
            title,
            message,
            metadata
        });
    } catch (error) {
        console.error('Failed to send notification:', error);
    }
}

// ==================== PAYMENT NOTIFICATIONS ====================

async function notifyPaymentReceived(payment, tenant) {
    const amount = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(payment.amount);

    // Notify Admin, SuperAdmin, and Accounting
    await notifyRoles(
        ['Admin', 'SuperAdmin', 'Accounting'],
        NotificationTypes.PAYMENT,
        '💰 Payment Received',
        `${tenant.firstName} ${tenant.lastName} paid ${amount} via ${payment.paymentMethod}`,
        { paymentId: payment.id, tenantId: tenant.id, amount: payment.amount }
    );

    // Notify the tenant
    if (tenant.accountId) {
        await notifyAccount(
            tenant.accountId,
            'Tenant',
            NotificationTypes.PAYMENT,
            '✅ Payment Confirmed',
            `Your payment of ${amount} has been received and processed successfully.`,
            { paymentId: payment.id, amount: payment.amount }
        );
    }
}

async function notifyPaymentOverdue(tenant, daysOverdue) {
    // Notify Accounting and Admin
    await notifyRoles(
        ['Admin', 'SuperAdmin', 'Accounting'],
        NotificationTypes.BILLING,
        '⚠️ Payment Overdue',
        `${tenant.firstName} ${tenant.lastName} has payment ${daysOverdue} days overdue`,
        { tenantId: tenant.id, daysOverdue }
    );

    // Notify the tenant
    if (tenant.accountId) {
        await notifyAccount(
            tenant.accountId,
            'Tenant',
            NotificationTypes.BILLING,
            '⚠️ Payment Reminder',
            `Your payment is ${daysOverdue} days overdue. Please settle your balance as soon as possible.`,
            { daysOverdue }
        );
    }
}

// ==================== ACCOUNT NOTIFICATIONS ====================

async function notifyAccountCreated(account) {
    // Notify SuperAdmin about new account
    await notifyRoles(
        ['SuperAdmin'],
        NotificationTypes.ACCOUNT,
        '👤 New Account Created',
        `New ${account.role} account created: ${account.firstName} ${account.lastName} (${account.email})`,
        { accountId: account.id, role: account.role, status: account.status }
    );

    // If account needs approval
    if (account.status === 'Pending') {
        await notifyRoles(
            ['Admin', 'SuperAdmin'],
            NotificationTypes.ACCOUNT,
            '⏳ Account Pending Approval',
            `${account.firstName} ${account.lastName} is waiting for account approval`,
            { accountId: account.id }
        );
    }

    // Notify the new user
    await notifyAccount(
        account.id,
        account.role,
        NotificationTypes.ACCOUNT,
        '🎉 Welcome to BCFlats!',
        `Your account has been ${account.status === 'Active' ? 'activated' : 'created and is pending approval'}.`,
        { accountId: account.id }
    );
}

async function notifyAccountApproved(account) {
    // Notify the user
    await notifyAccount(
        account.id,
        account.role,
        NotificationTypes.ACCOUNT,
        '✅ Account Approved',
        `Your account has been approved! You now have full access to the system.`,
        { accountId: account.id }
    );

    // Notify admins
    await notifyRoles(
        ['SuperAdmin'],
        NotificationTypes.ACCOUNT,
        '✅ Account Approved',
        `${account.firstName} ${account.lastName}'s account has been approved`,
        { accountId: account.id }
    );
}

async function notifyAccountRejected(account, reason) {
    // Notify the user
    await notifyAccount(
        account.id,
        account.role,
        NotificationTypes.ACCOUNT,
        '❌ Account Rejected',
        reason || 'Your account registration has been rejected. Please contact support for more information.',
        { accountId: account.id }
    );
}

async function notifyAccountStatusChanged(account, oldStatus, newStatus) {
    // Notify the user
    await notifyAccount(
        account.id,
        account.role,
        NotificationTypes.ACCOUNT,
        '🔄 Account Status Updated',
        `Your account status has been changed from ${oldStatus} to ${newStatus}`,
        { accountId: account.id, oldStatus, newStatus }
    );

    // Notify admins
    await notifyRoles(
        ['SuperAdmin'],
        NotificationTypes.ACCOUNT,
        '🔄 Account Status Changed',
        `${account.firstName} ${account.lastName}'s status changed: ${oldStatus} → ${newStatus}`,
        { accountId: account.id, oldStatus, newStatus }
    );
}

// ==================== TENANT NOTIFICATIONS ====================

async function notifyTenantCheckedIn(tenant, room) {
    // Notify Admin, SuperAdmin, and Accounting
    await notifyRoles(
        ['Admin', 'SuperAdmin', 'Accounting'],
        NotificationTypes.TENANT,
        '🏠 New Tenant Check-In',
        `${tenant.firstName} ${tenant.lastName} checked into Room ${room.roomNumber}`,
        { tenantId: tenant.id, roomId: room.id }
    );

    // Notify the tenant
    if (tenant.accountId) {
        await notifyAccount(
            tenant.accountId,
            'Tenant',
            NotificationTypes.TENANT,
            '🎉 Welcome to Your New Home!',
            `You've successfully checked into Room ${room.roomNumber}. Enjoy your stay!`,
            { roomNumber: room.roomNumber }
        );
    }
}

async function notifyTenantCheckedOut(tenant, room, finalBalance) {
    const balance = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(finalBalance);

    // Notify Admin, SuperAdmin, and Accounting
    await notifyRoles(
        ['Admin', 'SuperAdmin', 'Accounting'],
        NotificationTypes.TENANT,
        '👋 Tenant Check-Out',
        `${tenant.firstName} ${tenant.lastName} checked out from Room ${room.roomNumber}. Final balance: ${balance}`,
        { tenantId: tenant.id, roomId: room.id, finalBalance }
    );

    // Notify the tenant
    if (tenant.accountId) {
        await notifyAccount(
            tenant.accountId,
            'Tenant',
            NotificationTypes.TENANT,
            '👋 Check-Out Complete',
            `You've successfully checked out from Room ${room.roomNumber}. Final balance: ${balance}`,
            { finalBalance }
        );
    }
}

async function notifyTenantUpdated(tenant, updatedFields) {
    // Notify Admin and SuperAdmin
    await notifyRoles(
        ['Admin', 'SuperAdmin'],
        NotificationTypes.TENANT,
        '📝 Tenant Information Updated',
        `${tenant.firstName} ${tenant.lastName}'s information has been updated`,
        { tenantId: tenant.id, updatedFields }
    );

    // Notify the tenant
    if (tenant.accountId) {
        await notifyAccount(
            tenant.accountId,
            'Tenant',
            NotificationTypes.TENANT,
            '📝 Your Information Updated',
            'Your tenant information has been updated by the administrator.',
            {}
        );
    }
}

// ==================== MAINTENANCE NOTIFICATIONS ====================

async function notifyMaintenanceRequestCreated(request, tenant) {
    // Notify Admin
    await notifyRoles(
        ['Admin', 'SuperAdmin'],
        NotificationTypes.MAINTENANCE,
        '🔧 New Maintenance Request',
        `${tenant.firstName} ${tenant.lastName} submitted: ${request.title} (${request.priority} priority)`,
        { requestId: request.id, tenantId: tenant.id, priority: request.priority }
    );

    // Notify the tenant
    if (tenant.accountId) {
        await notifyAccount(
            tenant.accountId,
            'Tenant',
            NotificationTypes.MAINTENANCE,
            '✅ Maintenance Request Submitted',
            `Your maintenance request "${request.title}" has been submitted and is being reviewed.`,
            { requestId: request.id }
        );
    }
}

async function notifyMaintenanceStatusChanged(request, tenant, oldStatus, newStatus) {
    // Notify Admin
    await notifyRoles(
        ['Admin', 'SuperAdmin'],
        NotificationTypes.MAINTENANCE,
        '🔧 Maintenance Status Updated',
        `Request "${request.title}" status: ${oldStatus} → ${newStatus}`,
        { requestId: request.id, oldStatus, newStatus }
    );

    // Notify the tenant
    if (tenant.accountId) {
        const statusEmoji = {
            'Pending': '⏳',
            'In Progress': '🔨',
            'Completed': '✅',
            'Cancelled': '❌'
        };
        
        await notifyAccount(
            tenant.accountId,
            'Tenant',
            NotificationTypes.MAINTENANCE,
            `${statusEmoji[newStatus] || '🔧'} Maintenance Update`,
            `Your request "${request.title}" status changed to: ${newStatus}`,
            { requestId: request.id, status: newStatus }
        );
    }
}

// ==================== BILLING NOTIFICATIONS ====================

async function notifyBillingCycleGenerated(tenant, cycleMonth, totalAmount) {
    const amount = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(totalAmount);

    // Notify Accounting
    await notifyRoles(
        ['Accounting', 'Admin', 'SuperAdmin'],
        NotificationTypes.BILLING,
        '📊 Billing Cycle Generated',
        `${cycleMonth} billing generated for ${tenant.firstName} ${tenant.lastName}: ${amount}`,
        { tenantId: tenant.id, cycleMonth, amount: totalAmount }
    );

    // Notify the tenant
    if (tenant.accountId) {
        await notifyAccount(
            tenant.accountId,
            'Tenant',
            NotificationTypes.BILLING,
            '📋 New Monthly Bill Available',
            `Your bill for ${cycleMonth} is now available. Amount due: ${amount}`,
            { cycleMonth, amount: totalAmount }
        );
    }
}

async function notifyDepositApplied(tenant, amount, reason) {
    const formattedAmount = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(amount);

    // Notify Accounting and Admin
    await notifyRoles(
        ['Accounting', 'Admin', 'SuperAdmin'],
        NotificationTypes.BILLING,
        '🏦 Deposit Applied',
        `${formattedAmount} deposit applied for ${tenant.firstName} ${tenant.lastName}: ${reason}`,
        { tenantId: tenant.id, amount, reason }
    );

    // Notify the tenant
    if (tenant.accountId) {
        await notifyAccount(
            tenant.accountId,
            'Tenant',
            NotificationTypes.BILLING,
            '🏦 Deposit Applied to Balance',
            `${formattedAmount} from your deposit has been applied: ${reason}`,
            { amount, reason }
        );
    }
}

// ==================== SYSTEM NOTIFICATIONS ====================

async function notifySystemAnnouncement(title, message, roles = ['Admin', 'SuperAdmin', 'Accounting', 'Tenant']) {
    // Generate a unique announcement ID to group related notifications
    const announcementId = `announcement_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await notifyRoles(
        roles,
        NotificationTypes.SYSTEM,
        title,
        message,
        { announcementId, isAnnouncement: true }
    );
}

module.exports = {
    NotificationTypes,
    notifyRoles,
    notifyAccount,
    
    // Payment
    notifyPaymentReceived,
    notifyPaymentOverdue,
    
    // Account
    notifyAccountCreated,
    notifyAccountApproved,
    notifyAccountRejected,
    notifyAccountStatusChanged,
    
    // Tenant
    notifyTenantCheckedIn,
    notifyTenantCheckedOut,
    notifyTenantUpdated,
    
    // Maintenance
    notifyMaintenanceRequestCreated,
    notifyMaintenanceStatusChanged,
    
    // Billing
    notifyBillingCycleGenerated,
    notifyDepositApplied,
    
    // System
    notifySystemAnnouncement
};

