const db = require('../_helpers/db');
const { Op } = require('sequelize');

module.exports = {
    recordPayment,
    getPaymentsByTenant,
    getPaymentStats,
    getRecentPayments,
    getTenantsWithBillingInfo,
    processPayment,
    accrueMonthlyChargesIfNeeded,
    getDashboardStats
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
        // Ensure accruals are up to date for all active tenants
        await accrueMonthlyChargesIfNeeded();
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

        // Ensure latest accrual before applying payment
        await accrueMonthlyChargesIfNeeded(tenantId);

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

// Accrue monthly rent+utilities per active tenant if the current month hasn't been accrued yet.
// Optionally limit to a specific tenantId.
async function accrueMonthlyChargesIfNeeded(targetTenantId = null) {
    const now = new Date();
    const currentCycleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const whereTenant = targetTenantId ? { id: targetTenantId } : { status: 'Active' };
    const tenants = await db.Tenant.findAll({ where: whereTenant });

    for (const tenant of tenants) {
        // Skip if already accrued for this month
        const existing = await db.BillingCycle.findOne({ where: { tenantId: tenant.id, cycleMonth: currentCycleMonth } });
        if (existing) continue;

        const previousBalance = tenant.getOutstandingBalance();
        let depositApplied = 0;

        // Apply deposit as credit once when outstanding is zero or at first cycle
        if (tenant.deposit && !tenant.depositApplied) {
            depositApplied = Math.min(previousBalance, parseFloat(tenant.deposit));
            // If there is no previous balance, carry deposit as negative balance (credit)
            if (previousBalance <= 0) {
                depositApplied = parseFloat(tenant.deposit);
            }
            // Update tenant to mark deposit applied and reduce balance
            tenant.outstandingBalance = Math.max(0, previousBalance - depositApplied);
            tenant.depositPaid = true;
            await tenant.save();
        }

        const monthlyCharges = parseFloat(tenant.monthlyRent) + parseFloat(tenant.utilities);

        // Update balance with monthly charges
        const balanceBeforeCharges = tenant.getOutstandingBalance();
        const finalBalance = balanceBeforeCharges + monthlyCharges;
        tenant.outstandingBalance = finalBalance;
        tenant.nextDueDate = tenant.calculateNextDueDate();
        await tenant.save();

        // Sum payments made in this cycle month (optional; 0 default, actual payments will be recorded as they occur)
        const paymentsMade = 0;

        await db.BillingCycle.create({
            tenantId: tenant.id,
            cycleMonth: currentCycleMonth,
            previousBalance: previousBalance.toFixed(2),
            depositApplied: depositApplied.toFixed(2),
            monthlyCharges: monthlyCharges.toFixed(2),
            paymentsMade: paymentsMade.toFixed(2),
            finalBalance: finalBalance.toFixed(2)
        });
    }
}

// Get comprehensive dashboard statistics
async function getDashboardStats() {
    try {
        // Ensure accruals are up to date
        await accrueMonthlyChargesIfNeeded();
        
        // Get all active tenants with their billing info
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
            ]
        });

        // Calculate statistics
        const totalTenants = tenants.length;
        const totalUnpaidBills = tenants.filter(t => t.getOutstandingBalance() > 0).length;
        const totalOutstandingAmount = tenants.reduce((sum, t) => sum + t.getOutstandingBalance(), 0);
        
        // Get total payments made
        const paymentStats = await db.Payment.getPaymentStats();
        const totalAmountCollected = paymentStats.totalAmount || 0;
        
        // Get recent payments
        const recentPayments = await db.Payment.getRecentPayments(5);
        
        // Get tenants with highest outstanding balances
        const tenantsWithBalances = tenants
            .filter(t => t.getOutstandingBalance() > 0)
            .sort((a, b) => b.getOutstandingBalance() - a.getOutstandingBalance())
            .slice(0, 5)
            .map(tenant => ({
                id: tenant.id,
                name: `${tenant.account.firstName} ${tenant.account.lastName}`,
                email: tenant.account.email,
                roomNumber: tenant.room.roomNumber,
                floor: tenant.room.floor,
                outstandingBalance: tenant.getOutstandingBalance(),
                nextDueDate: tenant.nextDueDate || tenant.calculateNextDueDate()
            }));

        return {
            totalTenants,
            totalUnpaidBills,
            totalOutstandingAmount: parseFloat(totalOutstandingAmount.toFixed(2)),
            totalAmountCollected: parseFloat(totalAmountCollected),
            recentPayments: recentPayments.map(payment => ({
                id: payment.id,
                amount: parseFloat(payment.amount),
                paymentDate: payment.paymentDate,
                paymentMethod: payment.paymentMethod,
                tenantName: `${payment.tenant.account.firstName} ${payment.tenant.account.lastName}`,
                roomNumber: payment.tenant.room.roomNumber
            })),
            topOutstandingTenants: tenantsWithBalances
        };
    } catch (error) {
        throw new Error(`Failed to get dashboard stats: ${error.message}`);
    }
}
