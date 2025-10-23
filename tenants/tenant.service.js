const db = require('../_helpers/db');
const { Op } = require('sequelize');

module.exports = {
    getAllTenants,
    getTenantById,
    getActiveTenants,
    getTenantStats,
    createTenant,
    updateTenant,
    deleteTenant,
    checkInTenant,
    checkOutTenant,
    updateTenantStatus,
    getTenantsByAccount,
    getTenantsByRoom,
    getTenantBillingInfo,
    getArchivedTenants,
    getArchivedTenantById
};

// Get all tenants with account and room information (excludes checked out tenants)
async function getAllTenants(floor) {
    try {
        const roomInclude = {
            model: db.Room,
            as: 'room',
            attributes: ['id', 'roomNumber', 'floor', 'building', 'status']
        };

        if (floor !== undefined && floor !== null && floor !== '') {
            roomInclude.where = { floor };
            roomInclude.required = true; // only tenants on that floor
        }

        const tenants = await db.Tenant.findAll({
            where: {
                status: { [Op.ne]: 'Checked Out' } // Exclude checked out tenants
            },
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'status'],
                    where: { role: { [Op.ne]: 'Admin' } }
                },
                roomInclude
            ],
            order: [['checkInDate', 'DESC']]
        });

        return tenants;
    } catch (error) {
        throw new Error(`Failed to get tenants: ${error.message}`);
    }
}

// Get tenant by ID with account and room information
async function getTenantById(id) {
    try {
        const tenant = await db.Tenant.findByPk(id, {
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'status']
                },
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'roomNumber', 'floor', 'building', 'status', 'monthlyRent', 'utilities']
                }
            ]
        });

        return tenant;
    } catch (error) {
        throw new Error(`Failed to get tenant: ${error.message}`);
    }
}

// Get active tenants
async function getActiveTenants() {
    try {
        const tenants = await db.Tenant.findAll({
            where: { status: 'Active' },
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
                    where: { role: { [Op.ne]: 'Admin' } }
                },
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'roomNumber', 'floor', 'building']
                }
            ],
            order: [['checkInDate', 'DESC']]
        });

        return tenants;
    } catch (error) {
        throw new Error(`Failed to get active tenants: ${error.message}`);
    }
}

// Get tenant statistics
async function getTenantStats() {
    try {
        return await db.Tenant.getTenantStats();
    } catch (error) {
        throw new Error(`Failed to get tenant stats: ${error.message}`);
    }
}

// Create new tenant
async function createTenant(tenantData) {
    try {
        console.log('Creating tenant with data:', tenantData);
        
        // Validate required fields
        const { accountId, email, password, roomId, bedNumber, monthlyRent } = tenantData;
        
        if ((!accountId && !email) || !roomId || !bedNumber || !monthlyRent) {
            throw new Error('Missing required fields: accountId/email, roomId, bedNumber, monthlyRent');
        }

        console.log('Validated fields - roomId:', roomId, 'bedNumber:', bedNumber, 'type:', typeof bedNumber);

        // Resolve or create account — email has priority to avoid binding to wrong account
        let account = null;
        if (email) {
            account = await db.Account.findOne({ where: { email } });
            if (!account) {
                const bcrypt = require('bcryptjs');
                const passwordHash = bcrypt.hashSync(password || 'changeme123', 10);
                account = await db.Account.create({
                    title: 'tenant',
                    firstName: tenantData.firstName || 'Tenant',
                    lastName: tenantData.lastName || 'User',
                    email,
                    passwordHash,
                    status: 'Active',
                    role: 'Tenant'
                });
            }
        } else if (accountId) {
            account = await db.Account.findByPk(accountId);
        }
        if (!account) throw new Error('Account not found');

        // Ensure linked account is a Tenant account
        if (account.role !== 'Tenant') {
            // If caller provided email+password different from the admin, create a tenant account from those creds
            if (email && email !== account.email) {
                const existing = await db.Account.findOne({ where: { email } });
                if (existing) {
                    if (existing.role !== 'Tenant') {
                        throw new Error('Provided email belongs to a non-tenant account');
                    }
                    account = existing;
                } else {
                    const bcrypt = require('bcryptjs');
                    const passwordHash = bcrypt.hashSync(password || 'changeme123', 10);
                    account = await db.Account.create({
                        title: 'tenant',
                        firstName: tenantData.firstName || 'Tenant',
                        lastName: tenantData.lastName || 'User',
                        email,
                        passwordHash,
                        status: 'Active',
                        role: 'Tenant'
                    });
                }
            } else {
                throw new Error('Selected account is not a tenant. Please use a tenant account or provide email+password to create one.');
            }
        }

        // Check if room exists
        const room = await db.Room.findByPk(roomId);
        if (!room) {
            throw new Error('Room not found');
        }

        // Check if bed is available
        console.log('Checking bed availability for roomId:', roomId, 'bedNumber:', bedNumber);
        const existingTenant = await db.Tenant.findOne({
            where: { 
                roomId, 
                bedNumber, 
                status: 'Active' 
            }
        });

        console.log('Existing tenant found:', existingTenant ? `Bed ${existingTenant.bedNumber} occupied by tenant ${existingTenant.id}` : 'No existing tenant');

        if (existingTenant) {
            throw new Error(`Bed ${bedNumber} is already occupied in this room`);
        }

        // Check if room has available beds
        if (room.occupiedBeds >= room.totalBeds) {
            throw new Error('Room is fully occupied');
        }

        // Create tenant (do not change room occupancy until check-in)
        const tenant = await db.Tenant.create({
            ...tenantData,
            accountId: account.id,
            status: 'Pending',
            checkInDate: new Date()
        });

        // Return tenant with details
        return await getTenantById(tenant.id);
    } catch (error) {
        throw new Error(`Failed to create tenant: ${error.message}`);
    }
}

// Update tenant
async function updateTenant(id, updateData) {
    try {
        const tenant = await db.Tenant.findByPk(id);
        if (!tenant) return null;

        // Prevent updating certain fields if tenant is active
        if (tenant.status === 'Active') {
            delete updateData.roomId;
            delete updateData.bedNumber;
        }

        // If changing room or bed, validate availability
        if (updateData.roomId || updateData.bedNumber) {
            const newRoomId = updateData.roomId || tenant.roomId;
            const newBedNumber = updateData.bedNumber || tenant.bedNumber;

            const existingTenant = await db.Tenant.findOne({
                where: { 
                    roomId: newRoomId, 
                    bedNumber: newBedNumber, 
                    status: 'Active',
                    id: { [Op.ne]: id }
                }
            });

            if (existingTenant) {
                throw new Error(`Bed ${newBedNumber} is already occupied in the selected room`);
            }
        }

        await tenant.update(updateData);
        return await getTenantById(id);
    } catch (error) {
        throw new Error(`Failed to update tenant: ${error.message}`);
    }
}

// Delete tenant
async function deleteTenant(id) {
    try {
        const tenant = await db.Tenant.findByPk(id);
        if (!tenant) {
            throw new Error('Tenant not found');
        }

        if (tenant.status === 'Active') {
            throw new Error('Cannot delete active tenant. Please check out first.');
        }

        // Update room occupancy if tenant was active
        if (tenant.status === 'Active') {
            const room = await db.Room.findByPk(tenant.roomId);
            if (room) {
                await room.removeTenant();
            }
        }

        await tenant.destroy();
        return true;
    } catch (error) {
        throw new Error(`Failed to delete tenant: ${error.message}`);
    }
}

// Check in tenant
async function checkInTenant(id) {
    try {
        const tenant = await db.Tenant.findByPk(id);
        if (!tenant) return null;

        if (tenant.status === 'Active') {
            throw new Error('Tenant is already checked in');
        }

        // Check if bed is still available
        const existingTenant = await db.Tenant.findOne({
            where: { 
                roomId: tenant.roomId, 
                bedNumber: tenant.bedNumber, 
                status: 'Active',
                id: { [Op.ne]: id }
            }
        });

        if (existingTenant) {
            throw new Error(`Bed ${tenant.bedNumber} is no longer available in this room`);
        }

        await tenant.checkIn();

        // Update room occupancy upon successful check-in
        const room = await db.Room.findByPk(tenant.roomId);
        if (room) {
            await room.addTenant();
        }

        return await getTenantById(id);
    } catch (error) {
        throw new Error(`Failed to check in tenant: ${error.message}`);
    }
}

// Check out tenant and transfer to archive
async function checkOutTenant(id, checkoutData = {}) {
    try {
        const { archiveReason = 'Lease ended', archivedBy } = checkoutData;
        
        const tenant = await db.Tenant.findByPk(id, {
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
            throw new Error('Tenant is not currently checked in');
        }

        // Use archive service to properly archive the tenant
        const archiveService = require('../archives/archive.service');
        const archive = await archiveService.archiveTenant(id, archivedBy, archiveReason);

        // Suspend the associated account
        const account = await db.Account.findByPk(tenant.accountId);
        if (account) {
            account.status = 'Suspended';
            await account.save();
            console.log(`Account ${account.email} suspended after tenant checkout`);
        }

        // Update room occupancy
        const room = await db.Room.findByPk(tenant.roomId);
        if (room) {
            await room.removeTenant();
        }

        // Create archive notification for Admin and SuperAdmin
        const notificationService = require('../notifications/notification.service');
        await notificationService.broadcastToRoles({
            roles: ['Admin', 'SuperAdmin', 'HeadAdmin'],
            tenantId: tenant.id,
            type: 'tenant_archived',
            title: 'Tenant Checked Out - Archived',
            message: `${tenant.account.firstName} ${tenant.account.lastName} from Room ${tenant.room.roomNumber} has been checked out and archived. Account suspended. Outstanding balance: ₱${tenant.getOutstandingBalance().toFixed(2)}`,
            metadata: {
                archiveId: archive.id,
                archiveReason,
                finalBalance: tenant.getOutstandingBalance()
            }
        });

        return {
            message: 'Tenant successfully checked out and archived',
            archive: archive,
            tenant: await getTenantById(id)
        };
    } catch (error) {
        throw new Error(`Failed to check out tenant: ${error.message}`);
    }
}

// Update tenant status
async function updateTenantStatus(id, status) {
    try {
        const tenant = await db.Tenant.findByPk(id);
        if (!tenant) return null;

        // Validate status transition
        if (tenant.status === 'Active' && status === 'Pending') {
            throw new Error('Cannot change active tenant to pending status');
        }

        if (status === 'Active' && tenant.status !== 'Pending') {
            throw new Error('Only pending tenants can be activated');
        }

        await tenant.update({ status });
        return await getTenantById(id);
    } catch (error) {
        throw new Error(`Failed to update tenant status: ${error.message}`);
    }
}

// Get tenants by account
async function getTenantsByAccount(accountId) {
    try {
        const tenants = await db.Tenant.findAll({
            where: { accountId },
            attributes: [
                'id', 'accountId', 'roomId', 'bedNumber', 'checkInDate', 'checkOutDate',
                'leaseStart', 'leaseEnd', 'status', 'monthlyRent', 'utilities', 'deposit',
                'depositPaid', 'emergencyContact', 'specialRequirements', 'notes',
                'outstandingBalance', 'lastPaymentDate', 'nextDueDate', 'createdAt', 'updatedAt'
            ],
            include: [
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'roomNumber', 'floor', 'building', 'status']
                }
            ],
            order: [['checkInDate', 'DESC']]
        });

        return tenants;
    } catch (error) {
        throw new Error(`Failed to get tenants by account: ${error.message}`);
    }
}

// Get tenants by room
async function getTenantsByRoom(roomId) {
    try {
        const tenants = await db.Tenant.findAll({
            where: { roomId },
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'role']
                }
            ],
            order: [['bedNumber', 'ASC']]
        });

        return tenants;
    } catch (error) {
        throw new Error(`Failed to get tenants by room: ${error.message}`);
    }
}

// Get comprehensive billing information for a specific tenant
async function getTenantBillingInfo(tenantId) {
    try {
        // Ensure accruals (and deposit application) are up to date for this tenant before reading
        try {
            const paymentService = require('../payments/payment.service');
            if (typeof paymentService.accrueMonthlyChargesIfNeeded === 'function') {
                await paymentService.accrueMonthlyChargesIfNeeded(tenantId);
            }
        } catch (e) {
            console.warn('Accrual prefetch failed:', e.message);
        }

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
                    attributes: ['id', 'roomNumber', 'floor', 'building', 'monthlyRent', 'utilities']
                }
            ]
        });

        if (!tenant) {
            return null;
        }

        // Get payment history
        const payments = await db.Payment.findAll({
            where: { tenantId },
            order: [['paymentDate', 'DESC']],
            limit: 10
        });

        // Get billing cycles
        const billingCycles = await db.BillingCycle.findAll({
            where: { tenantId },
            order: [['cycleMonth', 'DESC']],
            limit: 6
        });

        const anyDepositApplied = billingCycles.some(c => parseFloat(c.depositApplied || 0) > 0);
        const totalMonthly = tenant.getTotalCost();
        
        // Calculate what balance SHOULD be based on actual deposit applied
        const totalDepositApplied = billingCycles.reduce((sum, c) => sum + parseFloat(c.depositApplied || 0), 0);
        // Use the LATEST cycle's finalBalance as the expected balance (not the sum)
        const expectedBalance = billingCycles.length > 0 ? parseFloat(billingCycles[0].finalBalance || 0) : tenant.getOutstandingBalance();
        
        // For UI display: always show balance with deposit deducted if it was applied
        // The actual ledger (outstandingBalance) remains correct, but we show a "display balance"
        // that reflects what the tenant should see after deposit consideration
        let correctedOutstanding;
        if (totalDepositApplied > 0) {
            // Deposit was applied in billing cycles - show original balance minus the deposit applied
            correctedOutstanding = Math.max(0, tenant.getOutstandingBalance() - totalDepositApplied);
        } else if (!anyDepositApplied) {
            // First time - compute deposit credit for display
            const computedCredit = Math.min(parseFloat(tenant.deposit || 0), totalMonthly);
            correctedOutstanding = Math.max(0, tenant.getOutstandingBalance() - computedCredit);
        } else {
            // Fallback - use as-is
            correctedOutstanding = tenant.getOutstandingBalance();
        }
        
        console.log(`[Tenant ${tenantId}] Balance Calculation:`, {
            originalBalance: tenant.getOutstandingBalance(),
            deposit: tenant.deposit,
            totalMonthly,
            anyDepositApplied,
            totalDepositApplied,
            expectedBalance,
            correctedOutstanding,
            cyclesCount: billingCycles.length,
            cycles: billingCycles.map(c => ({
                month: c.cycleMonth,
                depositApplied: c.depositApplied,
                charges: c.monthlyCharges,
                finalBalance: c.finalBalance
            }))
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
            totalMonthlyCost: tenant.getTotalCost(),
            outstandingBalance: correctedOutstanding,
            correctedOutstandingBalance: correctedOutstanding,
            deposit: parseFloat(tenant.deposit || 0),
            lastPaymentDate: tenant.lastPaymentDate,
            nextDueDate: tenant.nextDueDate || tenant.calculateNextDueDate(),
            checkInDate: tenant.checkInDate,
            leaseStart: tenant.leaseStart,
            leaseEnd: tenant.leaseEnd,
            status: tenant.status,
            paymentHistory: payments.map(payment => ({
                id: payment.id,
                amount: parseFloat(payment.amount),
                paymentDate: payment.paymentDate,
                paymentMethod: payment.paymentMethod,
                reference: payment.reference,
                description: payment.description,
                balanceAfter: parseFloat(payment.balanceAfter),
                status: payment.status
            })),
            billingCycles: billingCycles.map(cycle => ({
                id: cycle.id,
                cycleMonth: cycle.cycleMonth,
                previousBalance: parseFloat(cycle.previousBalance),
                depositApplied: parseFloat(cycle.depositApplied),
                monthlyCharges: parseFloat(cycle.monthlyCharges),
                paymentsMade: parseFloat(cycle.paymentsMade),
                finalBalance: parseFloat(cycle.finalBalance)
            })),
            depositAppliedThisCycle: anyDepositApplied,
            depositAppliedAmount: totalDepositApplied
        };
    } catch (error) {
        throw new Error(`Failed to get tenant billing info: ${error.message}`);
    }
}

// Get archived (checked out) tenants with search and filter
async function getArchivedTenants(filters = {}) {
    try {
        const { search, dateFrom, dateTo, floor, sortBy = 'checkOutDate', sortOrder = 'DESC' } = filters;

        // Build where clause
        const whereClause = {
            status: 'Checked Out'
        };

        // Search filter (name, email, room number)
        if (search && search.trim() !== '') {
            whereClause[Op.or] = [
                { '$account.firstName$': { [Op.like]: `%${search}%` } },
                { '$account.lastName$': { [Op.like]: `%${search}%` } },
                { '$account.email$': { [Op.like]: `%${search}%` } },
                { '$room.roomNumber$': { [Op.like]: `%${search}%` } }
            ];
        }

        // Date range filter
        if (dateFrom || dateTo) {
            whereClause.checkOutDate = {};
            if (dateFrom) {
                whereClause.checkOutDate[Op.gte] = new Date(dateFrom);
            }
            if (dateTo) {
                const endDate = new Date(dateTo);
                endDate.setHours(23, 59, 59, 999);
                whereClause.checkOutDate[Op.lte] = endDate;
            }
        }

        // Floor filter
        const roomInclude = {
            model: db.Room,
            as: 'room',
            attributes: ['id', 'roomNumber', 'floor', 'building']
        };
        if (floor !== undefined && floor !== null && floor !== '') {
            roomInclude.where = { floor };
        }

        // Fetch archived tenants
        const archivedTenants = await db.Tenant.findAll({
            where: whereClause,
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'title']
                },
                roomInclude
            ],
            order: [[sortBy, sortOrder]],
            subQuery: false
        });

        // Get payment history for each archived tenant
        const tenantsWithHistory = await Promise.all(archivedTenants.map(async tenant => {
            const payments = await db.Payment.findAll({
                where: { tenantId: tenant.id },
                order: [['paymentDate', 'DESC']]
            });

            const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            const billingCycles = await db.BillingCycle.findAll({
                where: { tenantId: tenant.id },
                order: [['cycleMonth', 'DESC']]
            });

            const totalCharges = billingCycles.reduce((sum, c) => sum + parseFloat(c.monthlyCharges || 0), 0);
            const totalDepositApplied = billingCycles.reduce((sum, c) => sum + parseFloat(c.depositApplied || 0), 0);

            return {
                id: tenant.id,
                name: `${tenant.account.firstName} ${tenant.account.lastName}`,
                email: tenant.account.email,
                roomNumber: tenant.room.roomNumber,
                floor: tenant.room.floor,
                building: tenant.room.building,
                checkInDate: tenant.checkInDate,
                checkOutDate: tenant.checkOutDate,
                leaseStart: tenant.leaseStart,
                leaseEnd: tenant.leaseEnd,
                monthlyRent: parseFloat(tenant.monthlyRent),
                utilities: parseFloat(tenant.utilities),
                deposit: parseFloat(tenant.deposit || 0),
                depositPaid: tenant.depositPaid,
                depositApplied: totalDepositApplied,
                finalBalance: tenant.getOutstandingBalance(),
                totalPaid: totalPaid,
                totalCharges: totalCharges,
                paymentCount: payments.length,
                billingCycleCount: billingCycles.length,
                status: tenant.status,
                emergencyContact: tenant.emergencyContact,
                notes: tenant.notes
            };
        }));

        return tenantsWithHistory;
    } catch (error) {
        throw new Error(`Failed to get archived tenants: ${error.message}`);
    }
}

// Get detailed information for a specific archived tenant
async function getArchivedTenantById(id) {
    try {
        const tenant = await db.Tenant.findByPk(id, {
            include: [
                {
                    model: db.Account,
                    as: 'account',
                    attributes: ['id', 'firstName', 'lastName', 'email', 'title']
                },
                {
                    model: db.Room,
                    as: 'room',
                    attributes: ['id', 'roomNumber', 'floor', 'building', 'monthlyRent', 'utilities']
                }
            ]
        });

        if (!tenant || tenant.status !== 'Checked Out') {
            return null;
        }

        // Get complete payment history
        const payments = await db.Payment.findAll({
            where: { tenantId: tenant.id },
            order: [['paymentDate', 'DESC']]
        });

        // Get billing cycles
        const billingCycles = await db.BillingCycle.findAll({
            where: { tenantId: tenant.id },
            order: [['cycleMonth', 'DESC']]
        });

        // Calculate statistics
        const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const totalCharges = billingCycles.reduce((sum, c) => sum + parseFloat(c.monthlyCharges || 0), 0);
        const totalDepositApplied = billingCycles.reduce((sum, c) => sum + parseFloat(c.depositApplied || 0), 0);

        // Calculate days stayed
        const checkIn = new Date(tenant.checkInDate);
        const checkOut = new Date(tenant.checkOutDate);
        const daysStayed = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        return {
            id: tenant.id,
            name: `${tenant.account.firstName} ${tenant.account.lastName}`,
            email: tenant.account.email,
            title: tenant.account.title,
            roomNumber: tenant.room.roomNumber,
            floor: tenant.room.floor,
            building: tenant.room.building,
            bedNumber: tenant.bedNumber,
            checkInDate: tenant.checkInDate,
            checkOutDate: tenant.checkOutDate,
            daysStayed: daysStayed,
            leaseStart: tenant.leaseStart,
            leaseEnd: tenant.leaseEnd,
            monthlyRent: parseFloat(tenant.monthlyRent),
            utilities: parseFloat(tenant.utilities),
            totalMonthlyCost: tenant.getTotalCost(),
            deposit: parseFloat(tenant.deposit || 0),
            depositPaid: tenant.depositPaid,
            depositApplied: totalDepositApplied,
            finalBalance: tenant.getOutstandingBalance(),
            totalPaid: totalPaid,
            totalCharges: totalCharges,
            emergencyContact: tenant.emergencyContact,
            specialRequirements: tenant.specialRequirements,
            notes: tenant.notes,
            status: tenant.status,
            paymentHistory: payments.map(payment => ({
                id: payment.id,
                amount: parseFloat(payment.amount),
                paymentDate: payment.paymentDate,
                paymentMethod: payment.paymentMethod,
                reference: payment.reference,
                description: payment.description,
                balanceAfter: parseFloat(payment.balanceAfter),
                status: payment.status
            })),
            billingCycles: billingCycles.map(cycle => ({
                id: cycle.id,
                cycleMonth: cycle.cycleMonth,
                previousBalance: parseFloat(cycle.previousBalance),
                depositApplied: parseFloat(cycle.depositApplied),
                monthlyCharges: parseFloat(cycle.monthlyCharges),
                paymentsMade: parseFloat(cycle.paymentsMade),
                finalBalance: parseFloat(cycle.finalBalance)
            }))
        };
    } catch (error) {
        throw new Error(`Failed to get archived tenant details: ${error.message}`);
    }
}
