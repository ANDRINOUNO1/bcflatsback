const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Payment = sequelize.define('Payment', {
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
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                min: 0.01
            }
        },
        paymentDate: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        paymentMethod: {
            type: DataTypes.ENUM('Cash', 'Bank Transfer', 'Credit Card', 'Debit Card', 'Check', 'Mobile Payment'),
            allowNull: false
        },
        reference: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'Transaction reference or check number'
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Payment description or notes'
        },
        balanceBefore: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Outstanding balance before this payment'
        },
        balanceAfter: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Outstanding balance after this payment'
        },
        processedBy: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'bcflats_accounts',
                key: 'id'
            },
            comment: 'Admin who processed the payment'
        },
        status: {
            type: DataTypes.ENUM('Completed', 'Pending', 'Failed', 'Refunded'),
            defaultValue: 'Completed'
        }
    }, {
        tableName: 'bcflats_payments',
        timestamps: true,
        indexes: [
            {
                fields: ['tenantId', 'paymentDate']
            },
            {
                fields: ['paymentDate']
            },
            {
                fields: ['status']
            }
        ]
    });

    // Instance methods
    Payment.prototype.getPaymentSummary = function() {
        return {
            id: this.id,
            amount: parseFloat(this.amount),
            paymentDate: this.paymentDate,
            paymentMethod: this.paymentMethod,
            reference: this.reference,
            description: this.description,
            balanceBefore: parseFloat(this.balanceBefore),
            balanceAfter: parseFloat(this.balanceAfter),
            status: this.status,
            createdAt: this.createdAt
        };
    };

    // Class methods
    Payment.getPaymentsByTenant = function(tenantId, limit = 50) {
        return this.findAll({
            where: { tenantId },
            include: [
                {
                    model: sequelize.models.Account,
                    as: 'processedByAccount',
                    attributes: ['id', 'firstName', 'lastName']
                }
            ],
            order: [['paymentDate', 'DESC']],
            limit
        });
    };

    Payment.getPaymentStats = async function(tenantId = null) {
        const whereClause = tenantId ? { tenantId } : {};
        
        const totalPayments = await this.count({ where: whereClause });
        const totalAmount = await this.sum('amount', { 
            where: { ...whereClause, status: 'Completed' } 
        }) || 0;
        
        const monthlyStats = await this.findAll({
            where: { ...whereClause, status: 'Completed' },
            attributes: [
                [sequelize.fn('DATE_FORMAT', sequelize.col('paymentDate'), '%Y-%m'), 'month'],
                [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'paymentCount']
            ],
            group: [sequelize.fn('DATE_FORMAT', sequelize.col('paymentDate'), '%Y-%m')],
            order: [[sequelize.fn('DATE_FORMAT', sequelize.col('paymentDate'), '%Y-%m'), 'DESC']],
            limit: 12
        });

        return {
            totalPayments,
            totalAmount: parseFloat(totalAmount),
            monthlyStats: monthlyStats.map(stat => ({
                month: stat.dataValues.month,
                totalAmount: parseFloat(stat.dataValues.totalAmount),
                paymentCount: parseInt(stat.dataValues.paymentCount)
            }))
        };
    };

    Payment.getRecentPayments = function(limit = 10) {
        return this.findAll({
            include: [
                {
                    model: sequelize.models.Tenant,
                    as: 'tenant',
                    attributes: ['id'],
                    include: [
                        {
                            model: sequelize.models.Account,
                            as: 'account',
                            attributes: ['firstName', 'lastName']
                        },
                        {
                            model: sequelize.models.Room,
                            as: 'room',
                            attributes: ['roomNumber']
                        }
                    ]
                },
                {
                    model: sequelize.models.Account,
                    as: 'processedByAccount',
                    attributes: ['firstName', 'lastName']
                }
            ],
            order: [['paymentDate', 'DESC']],
            limit
        });
    };

    return Payment;
};
