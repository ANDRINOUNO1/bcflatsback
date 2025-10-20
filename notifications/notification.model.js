const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Notification = sequelize.define('Notification', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        recipientRole: { 
            type: DataTypes.ENUM('Tenant', 'Accounting', 'Admin', 'SuperAdmin'), 
            allowNull: false 
        },
        recipientAccountId: { 
            type: DataTypes.INTEGER, 
            allowNull: true, 
            references: { model: 'bcflats_accounts', key: 'id' } 
        },
        tenantId: { 
            type: DataTypes.INTEGER, 
            allowNull: true, 
            references: { model: 'bcflats_tenants', key: 'id' } 
        },
        type: { type: DataTypes.STRING(64), allowNull: false },
        title: { type: DataTypes.STRING(255), allowNull: false },
        message: { type: DataTypes.TEXT, allowNull: false },
        metadata: { type: DataTypes.JSON, allowNull: true, defaultValue: {} },
        isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    }, {
        tableName: 'bcflats_notifications',
        timestamps: true,
        indexes: [
            { fields: ['recipientRole'] },
            { fields: ['recipientAccountId'] },
            { fields: ['tenantId'] },
            { fields: ['isRead'] },
        ]
    });

    return Notification;
};


