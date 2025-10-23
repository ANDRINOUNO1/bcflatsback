module.exports = (sequelize, DataTypes) => {
    const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        accountId: { type: DataTypes.INTEGER, allowNull: false },
        permissions: { type: DataTypes.TEXT, allowNull: false }, // JSON string of navigation permissions
        createdBy: { type: DataTypes.INTEGER, allowNull: true },
        updatedBy: { type: DataTypes.INTEGER, allowNull: true },
        created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    };

    const options = {
        timestamps: false,
        tableName: 'bcflats_navigation_permissions',
        indexes: [
            { fields: ['accountId'] },
            { unique: true, fields: ['accountId'], name: 'unique_account_navigation' }
        ]
    };

    const NavigationPermission = sequelize.define('NavigationPermission', attributes, options);

    // Seed default navigation permissions
    NavigationPermission.seedDefaults = async function() {
        // This model doesn't need to seed individual permissions
        // It only stores custom navigation permissions for specific accounts
        // The default permissions are handled in account.service.js
        console.log('NavigationPermission model initialized - no seeding required');
    };

    return NavigationPermission;
};
