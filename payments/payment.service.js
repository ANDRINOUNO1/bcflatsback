const db = require('../_helpers/db');
const { Op } = require('sequelize');

module.exports = {
    recordPayment,
    getPaymentsByTenant,
    getPaymentStats,
    getRecentPayments,
    getTenantsWithBillingInfo,
    processPayment
};

// Record a new payment
async function recordPayment(paymentData) {
    try {
        const { tenantId, amount, paymentMethod, reference, description, processedBy } = paymentData;
        
        // Validate required fields
        if (!tenantId || !amount || !paymentMethod) {
            throw new Error('Missing required fields: tenantId, amount, paymentMethod');
        }

        // Get tenant with current balance
        const tenant = await db.Tenant.findByPk(tenantId, {
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                },
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'roomNumber', 'floor', 'building']
                }
            ]
        });

        if (!tenant) {
            throw new Error('Tenant not found');
        }

        if (tenant.status !== 'Active') {
            throw new Error('Cannot record payment for inactive tenant');
        }

        const balanceBefore = tenant.getOutstandingBalance();
        const paymentAmount = parseFloat(amount);

        if (paymentAmount <= 0) {
            throw new Error('Payment amount must be greater than 0');
        }

        // Process payment and update tenant balance
        const balanceUpdate = await tenant.makePayment(paymentAmount);
        
        // Create payment record
        const payment = await db.Payment.create({
            tenantId,
            amount: paymentAmount,
            paymentDate: new Date(),
            paymentMethod,
            reference: reference || null,
            description: description || null,
            balanceBefore: balanceUpdate.balanceBefore,
            balanceAfter: balanceUpdate.balanceAfter,
            processedBy: processedBy || null,
            status: 'Completed'
        });

        // Return payment with tenant details
        return await getPaymentById(payment.id);
    } catch (error) {
        throw new Error(`Failed to record payment: ${error.message}`);
    }
}

// Get payment by ID with full details
async function getPaymentById(paymentId) {
    try {
        const payment = await db.Payment.findByPk(paymentId, {
            include: [
                {
                    model: db.Tenant,
                    as: 'tenant',
                    attributes: ['id'],
                    include: [
                        {
                            model: db.Account,
                            as: 'account',
                            attributes: ['id', 'firstName', 'lastName', 'email']
                        },
                        {
                            model: db.Room,
                            as: 'room',
                            attributes: ['id', 'roomNumber', 'floor', 'building']
                        }
                    ]
                },
                {
                    model: db.Account,
                    as: 'processedByAccount',
                    attributes: ['id', 'firstName', 'lastName']
                }
            ]
        });

        return payment;
    } catch (error) {
        throw new Error(`Failed to get payment: ${error.message}`);
    }
}

// Get payments by tenant
async function getPaymentsByTenant(tenantId, limit = 50) {
    try {
        const payments = await db.Payment.findAll({
            where: { tenantId },
            include: [
                {
                    model: db.Account,
                    as: 'processedByAccount',
                    attributes: ['id', 'firstName', 'lastName']
                }
            ],
            order: [['paymentDate', 'DESC']],
            limit: parseInt(limit)
        });

        return payments.map(payment => payment.getPaymentSummary());
    } catch (error) {
        throw new Error(`Failed to get payments by tenant: ${error.message}`);
    }
}

// Get payment statistics
async function getPaymentStats(tenantId = null) {
    try {
        return await db.Payment.getPaymentStats(tenantId);
    } catch (error) {
        throw new Error(`Failed to get payment stats: ${error.message}`);
    }
}

// Get recent payments across all tenants
async function getRecentPayments(limit = 10) {
    try {
        const payments = await db.Payment.getRecentPayments(limit);
        return payments.map(payment => ({
            id: payment.id,
            amount: parseFloat(payment.amount),
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            reference: payment.reference,
            description: payment.description,
            balanceAfter: parseFloat(payment.balanceAfter),
            status: payment.status,
            tenant: {
                id: payment.tenant.id,
                name: `${payment.tenant.account.firstName} ${payment.tenant.account.lastName}`,
                roomNumber: payment.tenant.room.roomNumber
            },
            processedBy: payment.processedByAccount ? 
                `${payment.processedByAccount.firstName} ${payment.processedByAccount.lastName}` : 
                'System',
            createdAt: payment.createdAt
        }));
    } catch (error) {
        throw new Error(`Failed to get recent payments: ${error.message}`);
    }
}

// Get tenants with billing information for accounting page
async function getTenantsWithBillingInfo() {
    try {
        const tenants = await db.Tenant.findAll({
            where: { status: 'Active' },
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email']
                },
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'roomNumber', 'floor', 'building']
                }
            ],
            order: [['outstandingBalance', 'DESC'], ['nextDueDate', 'ASC']]
        });

        return tenants.map(tenant => ({
            id: tenant.id,
            name: `${tenant.account.firstName} ${tenant.account.lastName}`,
            email: tenant.account.email,
            roomNumber: tenant.room.roomNumber,
            floor: tenant.room.floor,
            building: tenant.room.building,
            monthlyRent: parseFloat(tenant.monthlyRent),
            utilities: parseFloat(tenant.utilities),
            totalMonthlyCost: tenant.getTotalCost(),
            outstandingBalance: tenant.getOutstandingBalance(),
            lastPaymentDate: tenant.lastPaymentDate,
            nextDueDate: tenant.nextDueDate || tenant.calculateNextDueDate(),
            checkInDate: tenant.checkInDate,
            leaseStart: tenant.leaseStart,
            leaseEnd: tenant.leaseEnd,
            status: tenant.status
        }));
    } catch (error) {
        throw new Error(`Failed to get tenants with billing info: ${error.message}`);
    }
}

// Process payment with validation and balance update
async function processPayment(tenantId, paymentData) {
    try {
        // Validate tenant exists and is active
        const tenant = await db.Tenant.findByPk(tenantId);
        if (!tenant) {
            throw new Error('Tenant not found');
        }
        if (tenant.status !== 'Active') {
            throw new Error('Cannot process payment for inactive tenant');
        }

        // Record the payment
        const payment = await recordPayment({
            ...paymentData,
            tenantId
        });

        return payment;
    } catch (error) {
        throw new Error(`Failed to process payment: ${error.message}`);
    }
}
