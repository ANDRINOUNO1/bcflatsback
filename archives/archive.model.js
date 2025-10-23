const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Archive = sequelize.define('Archive', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        tenantId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'bcflats_tenants',
                key: 'id'
            }
        },
        accountId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'bcflats_accounts',
                key: 'id'
            }
        },
        roomId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'bcflats_rooms',
                key: 'id'
            }
        },
        bedNumber: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        checkInDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        checkOutDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        leaseStart: {
            type: DataTypes.DATE,
            allowNull: true
        },
        leaseEnd: {
            type: DataTypes.DATE,
            allowNull: true
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
        finalBalance: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Final balance when tenant was archived'
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
        },
        archivedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'bcflats_accounts',
                key: 'id'
            },
            comment: 'Account ID of the user who archived this tenant'
        },
        archiveReason: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'Reason for archiving (e.g., lease ended, moved out, etc.)'
        }
    }, {
        tableName: 'bcflats_archives',
        timestamps: true,
        indexes: [
            { fields: ['tenantId'] },
            { fields: ['accountId'] },
            { fields: ['roomId'] },
            { fields: ['checkOutDate'] },
            { fields: ['archivedBy'] }
        ]
    });

    // Instance methods
    Archive.prototype.getTotalCost = function() {
        return parseFloat(this.monthlyRent) + parseFloat(this.utilities);
    };

    Archive.prototype.getDuration = function() {
        if (!this.checkInDate || !this.checkOutDate) return 0;
        const diffTime = Math.abs(new Date(this.checkOutDate) - new Date(this.checkInDate));
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // days
    };

    // Class methods
    Archive.findByDateRange = function(startDate, endDate) {
        return this.findAll({
            where: {
                checkOutDate: {
                    [sequelize.Sequelize.Op.between]: [startDate, endDate]
                }
            },
            include: [
                { model: sequelize.models.Account, as: 'account' },
                { model: sequelize.models.Room, as: 'room' },
                { model: sequelize.models.Account, as: 'archivedByAccount' }
            ],
            order: [['checkOutDate', 'DESC']]
        });
    };

    Archive.getArchiveStats = async function() {
        const totalArchived = await this.count();
        const archivedThisMonth = await this.count({
            where: {
                checkOutDate: {
                    [sequelize.Sequelize.Op.gte]: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                }
            }
        });
        const archivedThisYear = await this.count({
            where: {
                checkOutDate: {
                    [sequelize.Sequelize.Op.gte]: new Date(new Date().getFullYear(), 0, 1)
                }
            }
        });

        return {
            totalArchived,
            archivedThisMonth,
            archivedThisYear
        };
    };

    Archive.seedDefaults = async function() {
        console.log('Archive seeder: No default archives to create');
    };

    return Archive;
};
