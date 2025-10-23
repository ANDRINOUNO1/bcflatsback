module.exports = (sequelize, DataTypes) => {
    const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING, allowNull: false, unique: true },
        description: { type: DataTypes.TEXT, allowNull: true },
        resource: { type: DataTypes.STRING, allowNull: false }, // Resource being accessed
        action: { type: DataTypes.STRING, allowNull: false }, // Action being performed
        created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    };

    const options = {
        timestamps: false,
        tableName: 'bcflats_permissions',
        indexes: [
            { fields: ['name'] },
            { unique: true, fields: ['resource', 'action'], name: 'unique_permission' }
        ]
    };

    const Permission = sequelize.define('Permission', attributes, options);

    // Seed default permissions
    Permission.seedDefaults = async function() {
        const defaultPermissions = [
            { name: 'permission.dashboard.view', description: 'View Dashboard', resource: 'dashboard', action: 'view' },
            { name: 'permission.rooms.view', description: 'View Rooms', resource: 'rooms', action: 'view' },
            { name: 'permission.rooms.create', description: 'Create Rooms', resource: 'rooms', action: 'create' },
            { name: 'permission.rooms.update', description: 'Update Rooms', resource: 'rooms', action: 'update' },
            { name: 'permission.rooms.delete', description: 'Delete Rooms', resource: 'rooms', action: 'delete' },
            { name: 'permission.tenants.view', description: 'View Tenants', resource: 'tenants', action: 'view' },
            { name: 'permission.tenants.create', description: 'Create Tenants', resource: 'tenants', action: 'create' },
            { name: 'permission.tenants.update', description: 'Update Tenants', resource: 'tenants', action: 'update' },
            { name: 'permission.tenants.delete', description: 'Delete Tenants', resource: 'tenants', action: 'delete' },
            { name: 'permission.accounting.view', description: 'View Accounting', resource: 'accounting', action: 'view' },
            { name: 'permission.accounting.update', description: 'Update Accounting', resource: 'accounting', action: 'update' },
            { name: 'permission.maintenance.view', description: 'View Maintenance', resource: 'maintenance', action: 'view' },
            { name: 'permission.maintenance.update', description: 'Update Maintenance', resource: 'maintenance', action: 'update' },
            { name: 'permission.announcements.view', description: 'View Announcements', resource: 'announcements', action: 'view' },
            { name: 'permission.announcements.create', description: 'Create Announcements', resource: 'announcements', action: 'create' },
            { name: 'permission.announcements.update', description: 'Update Announcements', resource: 'announcements', action: 'update' },
            { name: 'permission.announcements.delete', description: 'Delete Announcements', resource: 'announcements', action: 'delete' },
            { name: 'permission.archives.view', description: 'View Archives', resource: 'archives', action: 'view' },
            { name: 'permission.accounts.create', description: 'Create Accounts', resource: 'accounts', action: 'create' },
            { name: 'permission.accounts.update', description: 'Update Accounts', resource: 'accounts', action: 'update' },
            { name: 'permission.accounts.delete', description: 'Delete Accounts', resource: 'accounts', action: 'delete' }
        ];

        for (const permission of defaultPermissions) {
            await Permission.findOrCreate({
                where: { 
                    resource: permission.resource, 
                    action: permission.action 
                },
                defaults: permission
            });
        }
    };

    return Permission;
};