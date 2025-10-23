const mysql = require('mysql2/promise');
const config = require('./config.json');

async function resetDatabase() {
    let connection;
    
    try {
        console.log('Connecting to MySQL database...');
        connection = await mysql.createConnection({
            host: config.database.host,
            user: config.database.user,
            password: config.database.password,
            database: config.database.name
        });

        console.log('Connected to database successfully');

        // Drop existing tables in the correct order (respecting foreign key constraints)
        const tablesToDrop = [
            'bcflats_account_permissions',
            'bcflats_account_roles', 
            'bcflats_permissions',
            'bcflats_roles',
            'bcflats_notifications',
            'bcflats_billing_cycles',
            'bcflats_payments',
            'bcflats_maintenance_requests',
            'bcflats_tenants',
            'bcflats_rooms',
            'bcflats_refresh_tokens',
            'bcflats_accounts'
        ];

        console.log('Dropping existing tables...');
        for (const table of tablesToDrop) {
            try {
                await connection.execute(`DROP TABLE IF EXISTS \`${table}\``);
                console.log(`Dropped table: ${table}`);
            } catch (error) {
                console.log(`Table ${table} may not exist: ${error.message}`);
            }
        }

        console.log('Database reset completed successfully!');
        console.log('You can now restart your server to recreate the tables with the new schema.');

    } catch (error) {
        console.error('Error resetting database:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

resetDatabase();
