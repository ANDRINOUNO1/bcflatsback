const config = require('../config.json');
const mysql = require('mysql2/promise');
const { Sequelize, DataTypes } = require('sequelize');

const db = {};
module.exports = db;

db.initialize = async function() {
    try {
        // Use environment variables if available, otherwise fall back to config.json
        const host = process.env.DB_HOST || config.db.host;
        const port = process.env.DB_PORT || config.db.port;
        const user = process.env.DB_USER || config.db.username;
        const password = process.env.DB_PASSWORD || config.db.password;
        const database = process.env.DB_NAME || config.db.database;
        
        console.log('Attempting to connect to database...');
        
        const connection = await mysql.createConnection({ host, port, user, password });
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
        await connection.end();

        // connect to db
        const sequelize = new Sequelize(database, user, password, {
            dialect: 'mysql',
            logging: false,
            host: host,
            port: port
        });

        // Test the connection
        await sequelize.authenticate();
        console.log('Database connection established successfully');
       
        // Core models
        db.Account = require('../account/account.model')(sequelize, DataTypes);
        db.RefreshToken = require('../account/refresh-token.model')(sequelize, DataTypes);
        db.NavigationPermission = require('../account/navigation-permission.model')(sequelize, DataTypes);
        db.Permission = require('../account/permission.model')(sequelize, DataTypes);
        db.Role = require('../account/role.model')(sequelize, DataTypes);
        db.AccountPermission = require('../account/account-permission.model')(sequelize, DataTypes);
        db.AccountRole = require('../account/account-role.model')(sequelize, DataTypes);
        
        // Business models
        db.Room = require('../rooms/room.model')(sequelize, DataTypes);
        db.Tenant = require('../tenants/tenant.model')(sequelize, DataTypes);
        db.Maintenance = require('../maintenance/maintenance.model')(sequelize, DataTypes);
        db.Payment = require('../payments/payment.model')(sequelize, DataTypes);
        db.Notification = require('../notifications/notification.model')(sequelize, DataTypes);
        db.BillingCycle = require('../payments/billing-cycle.model')(sequelize, DataTypes);
        
        // Archive and Announcement models
        db.Archive = require('../archives/archive.model')(sequelize, DataTypes);
        db.Announcement = require('../announcements/announcement.model')(sequelize, DataTypes);

        // Simple relationships
        db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE', foreignKey: 'accountId' });
        db.RefreshToken.belongsTo(db.Account, { foreignKey: 'accountId' });

        // Navigation permission relationships
        db.Account.hasMany(db.NavigationPermission, { foreignKey: 'accountId', as: 'navigationPermissions' });
        db.NavigationPermission.belongsTo(db.Account, { foreignKey: 'accountId', as: 'account' });

        // Role and Permission relationships
        db.Account.belongsToMany(db.Role, { through: db.AccountRole, foreignKey: 'accountId', as: 'roles' });
        db.Role.belongsToMany(db.Account, { through: db.AccountRole, foreignKey: 'roleId', as: 'accounts' });
        
        db.Account.belongsToMany(db.Permission, { through: db.AccountPermission, foreignKey: 'accountId', as: 'permissions' });
        db.Permission.belongsToMany(db.Account, { through: db.AccountPermission, foreignKey: 'permissionId', as: 'accounts' });
        
        // AccountRole relationships
        db.AccountRole.belongsTo(db.Account, { foreignKey: 'accountId', as: 'account' });
        db.AccountRole.belongsTo(db.Role, { foreignKey: 'roleId', as: 'role' });
        db.AccountRole.belongsTo(db.Account, { foreignKey: 'assignedBy', as: 'assignedByAccount' });
        
        // AccountPermission relationships
        db.AccountPermission.belongsTo(db.Account, { foreignKey: 'accountId', as: 'account' });
        db.AccountPermission.belongsTo(db.Permission, { foreignKey: 'permissionId', as: 'permission' });
        db.AccountPermission.belongsTo(db.Account, { foreignKey: 'grantedBy', as: 'grantedByAccount' });

        // Room and Tenant relationships
        db.Room.hasMany(db.Tenant, { foreignKey: 'roomId', as: 'tenants' });
        db.Tenant.belongsTo(db.Room, { foreignKey: 'roomId', as: 'room' });

        db.Account.hasMany(db.Tenant, { foreignKey: 'accountId', as: 'tenants' });
        db.Tenant.belongsTo(db.Account, { foreignKey: 'accountId', as: 'account' });

        // Maintenance relationships
        db.Tenant.hasMany(db.Maintenance, { foreignKey: 'tenantId', as: 'maintenanceRequests' });
        db.Maintenance.belongsTo(db.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
        db.Room.hasMany(db.Maintenance, { foreignKey: 'roomId', as: 'maintenanceRequests' });
        db.Maintenance.belongsTo(db.Room, { foreignKey: 'roomId', as: 'room' });

        // Payment relationships
        db.Tenant.hasMany(db.Payment, { foreignKey: 'tenantId', as: 'payments' });
        db.Payment.belongsTo(db.Tenant, { foreignKey: 'tenantId', as: 'tenant' });
        db.Account.hasMany(db.Payment, { foreignKey: 'processedBy', as: 'processedPayments' });
        db.Payment.belongsTo(db.Account, { foreignKey: 'processedBy', as: 'processedByAccount' });

        // Billing cycles
        db.Tenant.hasMany(db.BillingCycle, { foreignKey: 'tenantId', as: 'billingCycles' });
        db.BillingCycle.belongsTo(db.Tenant, { foreignKey: 'tenantId', as: 'tenant' });

        // Notifications
        db.Account.hasMany(db.Notification, { foreignKey: 'recipientAccountId', as: 'notifications' });
        db.Notification.belongsTo(db.Account, { foreignKey: 'recipientAccountId', as: 'recipientAccount' });
        db.Tenant.hasMany(db.Notification, { foreignKey: 'tenantId', as: 'tenantNotifications' });
        db.Notification.belongsTo(db.Tenant, { foreignKey: 'tenantId', as: 'tenant' });

        // Archive relationships
        db.Account.hasMany(db.Archive, { foreignKey: 'accountId', as: 'archivedTenants' });
        db.Archive.belongsTo(db.Account, { foreignKey: 'accountId', as: 'account' });
        db.Room.hasMany(db.Archive, { foreignKey: 'roomId', as: 'archivedTenants' });
        db.Archive.belongsTo(db.Room, { foreignKey: 'roomId', as: 'room' });
        db.Account.hasMany(db.Archive, { foreignKey: 'archivedBy', as: 'archivedByAccount' });
        db.Archive.belongsTo(db.Account, { foreignKey: 'archivedBy', as: 'archivedByAccount' });

        // Announcement relationships
        db.Account.hasMany(db.Announcement, { foreignKey: 'createdBy', as: 'createdAnnouncements' });
        db.Announcement.belongsTo(db.Account, { foreignKey: 'createdBy', as: 'creator' });

        // Force sync to ensure all tables are created
        await sequelize.sync({ force: false, alter: true });
        console.log('Database synchronized successfully');

        // Navigation permissions are handled in account.service.js
        console.log('Navigation permission system initialized.');

        const userCount = await db.Account.count();
        if (userCount === 0) {
            await db.Account.seedDefaults();
            console.log('Default users have been seeded.');
        }

        // Seed roles if they don't exist
        const roleCount = await db.Role.count();
        if (roleCount === 0) {
            await db.Role.seedDefaults();
            console.log('Default roles have been seeded.');
        }

        // Seed navigation permissions if they don't exist
        const navPermissionCount = await db.NavigationPermission.count();
        if (navPermissionCount === 0) {
            await db.NavigationPermission.seedDefaults();
            console.log('Default navigation permissions have been seeded.');
        }

        // Seed permissions if they don't exist
        const permissionCount = await db.Permission.count();
        if (permissionCount === 0) {
            await db.Permission.seedDefaults();
            console.log('Default permissions have been seeded.');
        }

        // Seed rooms if they don't exist
        const roomCount = await db.Room.count();
        if (roomCount === 0) {
            await db.Room.seedDefaults();
            console.log('Default rooms have been seeded.');
        }

        db.sequelize = sequelize;

        console.log('Database initialization completed successfully');
        return true;
    } catch (error) {
        console.error('Error initializing database:', error);
        console.log('Server will continue without database connection');
        return false;
    }
}