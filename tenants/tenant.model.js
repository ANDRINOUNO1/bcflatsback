const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Tenant = sequelize.define('Tenant', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        accountId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'Accounts',
                key: 'id'
            }
        },
        roomId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'rooms',
                key: 'id'
            }
        },
        bedNumber: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 4
            }
        },
        checkInDate: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        checkOutDate: {
            type: DataTypes.DATE,
            allowNull: true
        },
        leaseStart: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW
        },
        leaseEnd: {
            type: DataTypes.DATE,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('Active', 'Inactive', 'Pending', 'Checked Out'),
            defaultValue: 'Pending'
        },
        monthlyRent: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        utilities: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        deposit: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00
        },
        depositPaid: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        emergencyContact: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: {}
        },
        specialRequirements: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        }
    }, {
        tableName: 'bcflats_tenants',
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['roomId', 'bedNumber', 'status'],
                where: {
                    status: 'Active'
                }
            }
        ]
    });

    // Instance methods
    Tenant.prototype.checkIn = async function() {
        this.status = 'Active';
        this.checkInDate = new Date();
        await this.save();
        return this;
    };

    Tenant.prototype.checkOut = async function() {
        this.status = 'Checked Out';
        this.checkOutDate = new Date();
        await this.save();
        return this;
    };

    Tenant.prototype.isActive = function() {
        return this.status === 'Active';
    };

    Tenant.prototype.getTotalCost = function() {
        return parseFloat(this.monthlyRent) + parseFloat(this.utilities);
    };

    // Class methods
    Tenant.findActiveTenants = function() {
        return this.findAll({
            where: { status: 'Active' },
            include: [
                { model: sequelize.models.Account, as: 'account' },
                { model: sequelize.models.Room, as: 'room' }
            ],
            order: [['checkInDate', 'DESC']]
        });
    };

    Tenant.findTenantsByRoom = function(roomId) {
        return this.findAll({
            where: { roomId },
            include: [
                { model: sequelize.models.Account, as: 'account' }
            ],
            order: [['bedNumber', 'ASC']]
        });
    };

    Tenant.findTenantByBed = function(roomId, bedNumber) {
        return this.findOne({
            where: { 
                roomId, 
                bedNumber,
                status: 'Active'
            },
            include: [
                { model: sequelize.models.Account, as: 'account' }
            ]
        });
    };

    Tenant.getTenantStats = async function() {
        const totalTenants = await this.count();
        const activeTenants = await this.count({ where: { status: 'Active' } });
        const pendingTenants = await this.count({ where: { status: 'Pending' } });
        const checkedOutTenants = await this.count({ where: { status: 'Checked Out' } });

        const totalRevenue = await this.sum('monthlyRent', { where: { status: 'Active' } }) || 0;
        const totalUtilities = await this.sum('utilities', { where: { status: 'Active' } }) || 0;

        return {
            totalTenants,
            activeTenants,
            pendingTenants,
            checkedOutTenants,
            totalRevenue: parseFloat(totalRevenue),
            totalUtilities: parseFloat(totalUtilities),
            totalIncome: parseFloat(totalRevenue) + parseFloat(totalUtilities)
        };
    };

    // Seeder method
    Tenant.seedDefaults = async function() {
        // This will be populated when tenants are added through the system
        console.log('Tenant seeder: No default tenants to create');
    };

    return Tenant;
};
