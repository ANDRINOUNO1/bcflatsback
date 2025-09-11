const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const BillingCycle = sequelize.define('BillingCycle', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        tenantId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'bcflats_tenants', key: 'id' } },
        cycleMonth: { type: DataTypes.STRING(7), allowNull: false, comment: 'YYYY-MM' },
        previousBalance: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        depositApplied: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        monthlyCharges: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        paymentsMade: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
        finalBalance: { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 }
    }, {
        tableName: 'bcflats_billing_cycles',
        timestamps: true,
        indexes: [
            { unique: true, fields: ['tenantId', 'cycleMonth'] },
            { fields: ['cycleMonth'] }
        ]
    });

    return BillingCycle;
};


