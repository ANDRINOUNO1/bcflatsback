const db = require('../_helpers/db');
const { Op } = require('sequelize');
const notifications = require('../notifications/notification.service');
const notificationHelper = require('../notifications/notification.helper');

module.exports = {
    recordPayment,
    getPaymentsByTenant,
    getPaymentStats,
    getRecentPayments,
    getTenantsWithBillingInfo,
    processPayment,
    accrueMonthlyChargesIfNeeded,
    getDashboardStats,
    createPendingPayment,
    confirmPayment,
    getPendingPayments,
    getPaymentById,
    checkAndNotifyOverduePayments,
    getOverdueTenants
};

async function recordPayment(paymentData) {
    const transaction = await db.sequelize.transaction();
    try {
        const { tenantId, amount, paymentMethod, reference, description, processedBy } = paymentData;
        
        if (!tenantId || !amount || !paymentMethod) {
            throw new Error('Missing required fields: tenantId, amount, paymentMethod');
        }

        const tenant = await db.Tenant.findByPk(tenantId, { transaction });

        if (!tenant) {
            throw new Error('Tenant not found');
        }

        if (tenant.status !== 'Active') {
            throw new Error('Cannot record payment for inactive tenant');
        }

        const paymentAmount = parseFloat(amount);

        if (paymentAmount <= 0) {
            throw new Error('Payment amount must be greater than 0');
        }

        const balanceUpdate = await tenant.makePayment(paymentAmount, { transaction });
        
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
        }, { transaction });

        await transaction.commit();

        const saved = await getPaymentById(payment.id);

        // Send notifications using helper
        try {
            await notificationHelper.notifyPaymentReceived(saved, saved.tenant);
        } catch (e) {
            console.warn('Notification dispatch failed:', e.message);
        }

        return saved;
    } catch (error) {
        await transaction.rollback();
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

        // Map tenants with corrected outstanding balance
        const tenantList = await Promise.all(tenants.map(async tenant => {
            // Get billing cycles to calculate deposit correction
            const billingCycles = await db.BillingCycle.findAll({
                where: { tenantId: tenant.id },
                order: [['cycleMonth', 'DESC']],
                limit: 6
            });

            const totalDepositApplied = billingCycles.reduce((sum, c) => sum + parseFloat(c.depositApplied || 0), 0);
            const totalMonthly = tenant.getTotalCost();
            const originalBalance = tenant.getOutstandingBalance();

            // Calculate corrected outstanding balance (same logic as getTenantBillingInfo)
            let correctedOutstanding;
            
            // For new tenants with no billing cycles, calculate as totalMonthly - deposit
            if (billingCycles.length === 0 && parseFloat(tenant.deposit || 0) > 0) {
                correctedOutstanding = Math.max(0, totalMonthly - parseFloat(tenant.deposit || 0));
                console.log(`[Accounting - Tenant ${tenant.id}] New tenant calculation: totalMonthly(${totalMonthly}) - deposit(${tenant.deposit}) = ${correctedOutstanding}`);
            } else if (totalDepositApplied > 0) {
                // Deposit was applied - show balance minus total deposit applied
                correctedOutstanding = Math.max(0, originalBalance - totalDepositApplied);
                console.log(`[Accounting - Tenant ${tenant.id}] Billing cycle calculation: outstanding(${originalBalance}) - depositApplied(${totalDepositApplied}) = ${correctedOutstanding}`);
            } else {
                // No deposit applied yet - use as-is
                correctedOutstanding = originalBalance;
                console.log(`[Accounting - Tenant ${tenant.id}] No deposit calculation: ${correctedOutstanding}`);
            }

            console.log(`[Accounting - Tenant ${tenant.id}] ${tenant.account.firstName} ${tenant.account.lastName}:`, {
                originalBalance,
                totalDepositApplied,
                correctedOutstanding,
                deposit: tenant.deposit
            });

            return {
                id: tenant.id,
                name: `${tenant.account.firstName} ${tenant.account.lastName}`,
                email: tenant.account.email,
                roomNumber: tenant.room.roomNumber,
                floor: tenant.room.floor,
                building: tenant.room.building,
                monthlyRent: parseFloat(tenant.monthlyRent),
                utilities: parseFloat(tenant.utilities),
                totalMonthlyCost: totalMonthly,
                outstandingBalance: correctedOutstanding,
                correctedOutstandingBalance: correctedOutstanding,
                lastPaymentDate: tenant.lastPaymentDate,
                nextDueDate: tenant.nextDueDate || tenant.calculateNextDueDate(),
                checkInDate: tenant.checkInDate,
                leaseStart: tenant.leaseStart,
                leaseEnd: tenant.leaseEnd,
                status: tenant.status,
                deposit: parseFloat(tenant.deposit || 0),
                depositApplied: totalDepositApplied
            };
        }));

        return tenantList;
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
        // Skip if already accrued for this month, but apply deposit correction if missed
        const existing = await db.BillingCycle.findOne({ where: { tenantId: tenant.id, cycleMonth: currentCycleMonth } });
        if (existing) {
            try {
                const anyDepositApplied = await db.BillingCycle.findOne({
                    where: { tenantId: tenant.id, depositApplied: { [Op.gt]: 0 } }
                });
                if (!anyDepositApplied && parseFloat(tenant.deposit) > 0 && parseFloat(existing.depositApplied || 0) === 0) {
                    const adjust = Math.min(parseFloat(tenant.deposit), parseFloat(existing.monthlyCharges || 0));
                    if (adjust > 0) {
                        existing.depositApplied = adjust.toFixed(2);
                        const existingFinal = parseFloat(existing.finalBalance || 0);
                        existing.finalBalance = Math.max(0, existingFinal - adjust).toFixed(2);
                        tenant.outstandingBalance = Math.max(0, tenant.getOutstandingBalance() - adjust);
                        tenant.depositPaid = true;
                        await existing.save();
                        await tenant.save();
                        try {
                            await notifications.createNotification({
                                recipientRole: 'Tenant',
                                recipientAccountId: tenant.accountId,
                                tenantId: tenant.id,
                                type: 'billing_correction',
                                title: 'Security deposit applied',
                                message: `We applied your security deposit of ${adjust.toFixed(2)} to this month's charges.`,
                                metadata: { cycleMonth: currentCycleMonth, adjustment: adjust }
                            });
                            await notifications.broadcastToRoles({
                                roles: ['Accounting', 'Admin', 'SuperAdmin'],
                                tenantId: tenant.id,
                                type: 'billing_correction',
                                title: 'Security deposit correction applied',
                                message: `Applied deposit ${adjust.toFixed(2)} to tenant #${tenant.id}'s current cycle.`,
                                metadata: { cycleMonth: currentCycleMonth, adjustment: adjust }
                            });
                        } catch (e) {
                            console.warn('Notification dispatch failed:', e.message);
                        }
                    }
                }
            } catch (e) {
                console.warn('Deposit correction failed:', e.message);
            }
            continue;
        }

        const previousBalance = tenant.getOutstandingBalance();
        const monthlyCharges = parseFloat(tenant.monthlyRent) + parseFloat(tenant.utilities);
        let depositApplied = 0;
        let chargesThisCycle = monthlyCharges;

        // Robust deposit handling: apply deposit once on the first ever billing cycle,
        // or if never recorded in any cycle (correction), regardless of depositPaid flag.
        const totalCycles = await db.BillingCycle.count({ where: { tenantId: tenant.id } });
        const depositCycle = await db.BillingCycle.findOne({ 
            where: { tenantId: tenant.id, depositApplied: { [Op.gt]: 0 } } 
        });
        const shouldApplyDeposit = (totalCycles === 0 || !depositCycle) && parseFloat(tenant.deposit) > 0;
        if (shouldApplyDeposit) {
            depositApplied = Math.max(0, parseFloat(tenant.deposit));
            // Apply only against this month's charges per spec
            depositApplied = Math.min(depositApplied, monthlyCharges);
            chargesThisCycle = Math.max(0, monthlyCharges - depositApplied);
            if (!tenant.depositPaid) {
                tenant.depositPaid = true;
            }
        }

        const finalBalance = previousBalance + chargesThisCycle;
        tenant.outstandingBalance = finalBalance;
        tenant.nextDueDate = tenant.calculateNextDueDate();
        await tenant.save();

        // Sum payments made in this cycle month (optional; 0 default, actual payments will be recorded as they occur)
        const paymentsMade = 0;

        const cycle = await db.BillingCycle.create({
            tenantId: tenant.id,
            cycleMonth: currentCycleMonth,
            previousBalance: previousBalance.toFixed(2),
            depositApplied: depositApplied.toFixed(2),
            monthlyCharges: monthlyCharges.toFixed(2),
            paymentsMade: paymentsMade.toFixed(2),
            finalBalance: finalBalance.toFixed(2)
        });

        // Notifications for monthly accrual and balance update
        try {
            await notifications.createNotification({
                recipientRole: 'Tenant',
                recipientAccountId: tenant.accountId,
                tenantId: tenant.id,
                type: 'billing_update',
                title: 'Monthly charges posted',
                message: `This month's charges: ${(monthlyCharges).toFixed(2)}. Remaining balance: ${finalBalance.toFixed(2)}.`,
                metadata: { cycleMonth: currentCycleMonth, cycleId: cycle.id, monthlyCharges, finalBalance, depositApplied }
            });
            await notifications.broadcastToRoles({
                roles: ['Accounting', 'Admin', 'SuperAdmin'],
                tenantId: tenant.id,
                type: 'billing_update',
                title: 'Tenant balance updated',
                message: `Tenant #${tenant.id} monthly accrual. Final balance: ${finalBalance.toFixed(2)}.`,
                metadata: { cycleMonth: currentCycleMonth, tenantId: tenant.id, finalBalance }
            });
        } catch (e) {
            console.warn('Notification dispatch failed:', e.message);
        }
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

// Create pending payment (for tenant submission)
async function createPendingPayment(tenantId, paymentData) {
    try {
        const { amount, paymentMethod, referenceNumber, description } = paymentData;
        
        if (!tenantId || !amount || !paymentMethod) {
            throw new Error('Missing required fields: tenantId, amount, paymentMethod');
        }

        const tenant = await db.Tenant.findByPk(tenantId);
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        if (tenant.status !== 'Active') {
            throw new Error('Cannot create payment for inactive tenant');
        }

        const paymentAmount = parseFloat(amount);
        if (paymentAmount <= 0) {
            throw new Error('Payment amount must be greater than 0');
        }

        // Validate payment method
        if (!['gcash', 'paymaya'].includes(paymentMethod.toLowerCase())) {
            throw new Error('Payment method must be either GCash or PayMaya');
        }

        const currentBalance = tenant.getOutstandingBalance();

        const payment = await db.Payment.create({
            tenantId,
            amount: paymentAmount,
            paymentDate: new Date(),
            paymentMethod: paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1),
            reference: referenceNumber || null,
            description: description || 'Rent payment',
            balanceBefore: currentBalance,
            balanceAfter: currentBalance, // Balance doesn't change until confirmed
            processedBy: null, // Will be set when confirmed
            status: 'Pending'
        });

        return await getPaymentById(payment.id);
    } catch (error) {
        throw new Error(`Failed to create pending payment: ${error.message}`);
    }
}

// Confirm pending payment (for accounting)
async function confirmPayment(paymentId, processedBy) {
    const transaction = await db.sequelize.transaction();
    try {
        const payment = await db.Payment.findByPk(paymentId, { transaction });
        
        if (!payment) {
            throw new Error('Payment not found');
        }

        if (payment.status !== 'Pending') {
            throw new Error('Payment is not pending confirmation');
        }

        const tenant = await db.Tenant.findByPk(payment.tenantId, { transaction });
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        if (tenant.status !== 'Active') {
            throw new Error('Cannot confirm payment for inactive tenant');
        }

        // Update tenant balance
        const balanceUpdate = await tenant.makePayment(payment.amount, { transaction });
        
        // Update payment status
        payment.status = 'Completed';
        payment.processedBy = processedBy;
        payment.balanceAfter = balanceUpdate.balanceAfter;
        await payment.save({ transaction });

        await transaction.commit();

        const saved = await getPaymentById(payment.id);
        try {
            await notifications.createNotification({
                recipientRole: 'Tenant',
                recipientAccountId: saved.tenant.account.id,
                tenantId: saved.tenant.id,
                type: 'payment_confirmed',
                title: 'Payment confirmed',
                message: `Your payment of ${parseFloat(saved.amount).toFixed(2)} was confirmed. Remaining balance: ${parseFloat(saved.balanceAfter).toFixed(2)}.`,
                metadata: { paymentId: saved.id, balanceAfter: saved.balanceAfter }
            });
            await notifications.broadcastToRoles({
                roles: ['Accounting', 'Admin', 'SuperAdmin'],
                tenantId: saved.tenant.id,
                type: 'payment_confirmed',
                title: 'Payment confirmed',
                message: `Payment for tenant #${saved.tenant.id} confirmed. New balance: ${parseFloat(saved.balanceAfter).toFixed(2)}.`,
                metadata: { paymentId: saved.id }
            });
        } catch (e) {
            console.warn('Notification dispatch failed:', e.message);
        }

        return saved;
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Failed to confirm payment: ${error.message}`);
    }
}

// Get pending payments for accounting
async function getPendingPayments() {
    try {
        const payments = await db.Payment.findAll({
            where: { status: 'Pending' },
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
                }
            ],
            order: [['createdAt', 'ASC']]
        });

        return payments.map(payment => ({
            id: payment.id,
            amount: parseFloat(payment.amount),
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            reference: payment.reference,
            description: payment.description,
            balanceBefore: parseFloat(payment.balanceBefore),
            status: payment.status,
            createdAt: payment.createdAt,
            tenant: {
                id: payment.tenant.id,
                name: `${payment.tenant.account.firstName} ${payment.tenant.account.lastName}`,
                email: payment.tenant.account.email,
                roomNumber: payment.tenant.room.roomNumber,
                floor: payment.tenant.room.floor,
                building: payment.tenant.room.building
            }
        }));
    } catch (error) {
        throw new Error(`Failed to get pending payments: ${error.message}`);
    }
}

// Check for overdue payments and send notifications to tenants
async function checkAndNotifyOverduePayments() {
    try {
        console.log('🔍 Checking for overdue payments...');
        
        // Ensure accruals are up to date
        await accrueMonthlyChargesIfNeeded();
        
        // Get all active tenants with outstanding balances
        const tenants = await db.Tenant.findAll({
            where: { 
                status: 'Active',
                outstandingBalance: { [Op.gt]: 0 }
            },
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

        const today = new Date();
        const overdueNotifications = [];

        for (const tenant of tenants) {
            const outstandingBalance = tenant.getOutstandingBalance();
            const nextDueDate = tenant.nextDueDate || tenant.calculateNextDueDate();
            const daysOverdue = Math.floor((today - nextDueDate) / (1000 * 60 * 60 * 24));

            // Only notify if payment is overdue (past due date) and has outstanding balance
            if (daysOverdue > 0 && outstandingBalance > 0) {
                // Check if we already sent a notification for this tenant in the last 3 days
                const hasRecentNotification = await notifications.hasRecentNotification({
                    tenantId: tenant.id,
                    type: 'payment_overdue',
                    days: 3
                });

                if (!hasRecentNotification) {
                    // Determine notification severity based on days overdue
                    let severity = 'warning';
                    let urgencyMessage = '';
                    
                    if (daysOverdue >= 30) {
                        severity = 'critical';
                        urgencyMessage = 'URGENT: Your payment is over 30 days overdue. Please contact management immediately.';
                    } else if (daysOverdue >= 14) {
                        severity = 'high';
                        urgencyMessage = 'Your payment is over 2 weeks overdue. Please make payment as soon as possible.';
                    } else if (daysOverdue >= 7) {
                        severity = 'medium';
                        urgencyMessage = 'Your payment is over 1 week overdue. Please arrange payment.';
                    } else {
                        urgencyMessage = 'Your payment is overdue. Please make payment to avoid additional charges.';
                    }

                    const notificationTitle = `Payment Overdue - ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`;
                    const notificationMessage = `Dear ${tenant.account.firstName},\n\n${urgencyMessage}\n\nOutstanding Balance: ₱${outstandingBalance.toFixed(2)}\nDue Date: ${nextDueDate.toLocaleDateString()}\nRoom: ${tenant.room.roomNumber}\n\nPlease contact the management office to arrange payment.\n\nThank you for your attention to this matter.`;

                    try {
                        // Send notification to tenant
                        await notifications.createNotification({
                            recipientRole: 'Tenant',
                            recipientAccountId: tenant.account.id,
                            tenantId: tenant.id,
                            type: 'payment_overdue',
                            title: notificationTitle,
                            message: notificationMessage,
                            metadata: {
                                severity,
                                daysOverdue,
                                outstandingBalance,
                                nextDueDate: nextDueDate.toISOString(),
                                roomNumber: tenant.room.roomNumber
                            }
                        });

                        // Also notify accounting and admin staff
                        await notifications.broadcastToRoles({
                            roles: ['Accounting', 'Admin', 'SuperAdmin'],
                            tenantId: tenant.id,
                            type: 'payment_overdue',
                            title: `Tenant Payment Overdue - ${tenant.account.firstName} ${tenant.account.lastName}`,
                            message: `Tenant ${tenant.account.firstName} ${tenant.account.lastName} (Room ${tenant.room.roomNumber}) has an overdue payment.\n\nDays Overdue: ${daysOverdue}\nOutstanding Balance: ₱${outstandingBalance.toFixed(2)}\nDue Date: ${nextDueDate.toLocaleDateString()}\nSeverity: ${severity.toUpperCase()}`,
                            metadata: {
                                severity,
                                daysOverdue,
                                outstandingBalance,
                                nextDueDate: nextDueDate.toISOString(),
                                tenantName: `${tenant.account.firstName} ${tenant.account.lastName}`,
                                roomNumber: tenant.room.roomNumber,
                                tenantEmail: tenant.account.email
                            }
                        });

                        overdueNotifications.push({
                            tenantId: tenant.id,
                            tenantName: `${tenant.account.firstName} ${tenant.account.lastName}`,
                            roomNumber: tenant.room.roomNumber,
                            daysOverdue,
                            outstandingBalance,
                            severity,
                            nextDueDate
                        });

                        console.log(`📧 Overdue notification sent to tenant ${tenant.id} (${tenant.account.firstName} ${tenant.account.lastName}) - ${daysOverdue} days overdue`);
                    } catch (error) {
                        console.error(`❌ Failed to send overdue notification to tenant ${tenant.id}:`, error.message);
                    }
                } else {
                    console.log(`⏭️ Skipping notification for tenant ${tenant.id} - recent notification already sent`);
                }
            }
        }

        console.log(`✅ Overdue payment check completed. Notifications sent: ${overdueNotifications.length}`);
        return {
            checked: tenants.length,
            overdue: overdueNotifications.length,
            notifications: overdueNotifications
        };
    } catch (error) {
        console.error('❌ Failed to check overdue payments:', error.message);
        throw new Error(`Failed to check overdue payments: ${error.message}`);
    }
}

// Get list of tenants with overdue payments
async function getOverdueTenants() {
    try {
        // Ensure accruals are up to date
        await accrueMonthlyChargesIfNeeded();
        
        const tenants = await db.Tenant.findAll({
            where: { 
                status: 'Active',
                outstandingBalance: { [Op.gt]: 0 }
            },
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

        const today = new Date();
        const overdueTenants = [];

        for (const tenant of tenants) {
            const outstandingBalance = tenant.getOutstandingBalance();
            const nextDueDate = tenant.nextDueDate || tenant.calculateNextDueDate();
            const daysOverdue = Math.floor((today - nextDueDate) / (1000 * 60 * 60 * 24));

            if (daysOverdue > 0 && outstandingBalance > 0) {
                // Determine severity
                let severity = 'warning';
                if (daysOverdue >= 30) severity = 'critical';
                else if (daysOverdue >= 14) severity = 'high';
                else if (daysOverdue >= 7) severity = 'medium';

                overdueTenants.push({
                    id: tenant.id,
                    name: `${tenant.account.firstName} ${tenant.account.lastName}`,
                    email: tenant.account.email,
                    roomNumber: tenant.room.roomNumber,
                    floor: tenant.room.floor,
                    building: tenant.room.building,
                    outstandingBalance,
                    nextDueDate,
                    daysOverdue,
                    severity,
                    monthlyRent: parseFloat(tenant.monthlyRent),
                    utilities: parseFloat(tenant.utilities),
                    lastPaymentDate: tenant.lastPaymentDate
                });
            }
        }

        // Sort by days overdue (most overdue first)
        overdueTenants.sort((a, b) => b.daysOverdue - a.daysOverdue);

        return overdueTenants;
    } catch (error) {
        throw new Error(`Failed to get overdue tenants: ${error.message}`);
    }
}
