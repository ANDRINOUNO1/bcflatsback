module.exports = (sequelize, DataTypes) => {
    const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING, allowNull: false, unique: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        level: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }, // Higher level = more permissions
        isSystemRole: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    };

    const options = {
        timestamps: false,
        tableName: 'bcflats_roles',
        indexes: [
            { fields: ['name'] },
            { fields: ['level'] }
        ]
    };

    const Role = sequelize.define('Role', attributes, options);

    // Define role hierarchy levels
    Role.ROLE_LEVELS = {
        HEAD_ADMIN: 100,
        SUPER_ADMIN: 90,
        ADMIN: 50,
        ACCOUNTING: 30,
        TENANT: 10
    };

    // Seed default roles
    Role.seedDefaults = async function() {
        const defaultRoles = [
            {
                name: 'HeadAdmin',
                description: 'Head Administrator with full system control and admin management capabilities',
                level: Role.ROLE_LEVELS.HEAD_ADMIN,
                isSystemRole: true
            },
            {
                name: 'SuperAdmin',
                description: 'Super Administrator with full access to all features',
                level: Role.ROLE_LEVELS.SUPER_ADMIN,
                isSystemRole: true
            },
            {
                name: 'Admin',
                description: 'Administrator with configurable permissions',
                level: Role.ROLE_LEVELS.ADMIN,
                isSystemRole: true
            },
            {
                name: 'Accounting',
                description: 'Accounting staff with financial management permissions',
                level: Role.ROLE_LEVELS.ACCOUNTING,
                isSystemRole: true
            },
            {
                name: 'Tenant',
                description: 'Tenant with limited access to personal information',
                level: Role.ROLE_LEVELS.TENANT,
                isSystemRole: true
            }
        ];

        for (const role of defaultRoles) {
            await Role.findOrCreate({
                where: { name: role.name },
                defaults: role
            });
        }
    };

    return Role;
};
