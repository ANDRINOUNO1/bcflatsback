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
       
        db.Account = require('../account/account.model')(sequelize, DataTypes);
        db.RefreshToken = require('../account/refresh-token.model')(sequelize, DataTypes);
        db.Room = require('../rooms/room.model')(sequelize, DataTypes);
        db.Tenant = require('../tenants/tenant.model')(sequelize, DataTypes);
        db.Maintenance = require('../maintenance/maintenance.model')(sequelize, DataTypes);
        db.Payment = require('../payments/payment.model')(sequelize, DataTypes);

        // define relationships
        db.Account.hasMany(db.RefreshToken, { onDelete: 'CASCADE', foreignKey: 'accountId' });
        db.RefreshToken.belongsTo(db.Account, { foreignKey: 'accountId' });

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

        await sequelize.sync({ force: false });
        console.log('Database synchronized successfully');

        const userCount = await db.Account.count();
        if (userCount === 0) {
            await db.Account.seedDefaults();
            console.log('Default users have been seeded.');
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
