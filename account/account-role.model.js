module.exports = (sequelize, DataTypes) => {
    const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        accountId: { type: DataTypes.INTEGER, allowNull: false },
        roleId: { type: DataTypes.INTEGER, allowNull: false },
        assignedBy: { type: DataTypes.INTEGER, allowNull: true }, // Who assigned this role
        assignedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        expiresAt: { type: DataTypes.DATE, allowNull: true }, // Optional role expiration
        created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    };

    const options = {
        timestamps: false,
        tableName: 'bcflats_account_roles',
        indexes: [
            { fields: ['accountId'] },
            { fields: ['roleId'] },
            { fields: ['assignedBy'] },
            { unique: true, fields: ['accountId', 'roleId'] }
        ]
    };

    const AccountRole = sequelize.define('AccountRole', attributes, options);

    return AccountRole;
};
