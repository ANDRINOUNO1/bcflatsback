module.exports = (sequelize, DataTypes) => {
    const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        accountId: { type: DataTypes.INTEGER, allowNull: false },
        permissionId: { type: DataTypes.INTEGER, allowNull: false },
        grantedBy: { type: DataTypes.INTEGER, allowNull: true }, // Who granted this permission
        grantedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        expiresAt: { type: DataTypes.DATE, allowNull: true }, // Optional permission expiration
        created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    };

    const options = {
        timestamps: false,
        tableName: 'bcflats_account_permissions',
        indexes: [
            { fields: ['accountId'] },
            { fields: ['permissionId'] },
            { fields: ['grantedBy'] },
            { unique: true, fields: ['accountId', 'permissionId'] }
        ]
    };

    const AccountPermission = sequelize.define('AccountPermission', attributes, options);

    return AccountPermission;
};
