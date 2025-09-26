const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: DataTypes.STRING, allowNull: true },
        firstName: { type: DataTypes.STRING, allowNull: false },
        lastName: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: false },
        passwordHash: { type: DataTypes.STRING, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Pending' },
        role: { 
            type: DataTypes.ENUM('Admin', 'SuperAdmin', 'Tenant', 'Accounting'), 
            allowNull: false, 
            defaultValue: 'Tenant' 
        },
        created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    };

    const options = {
        timestamps: false,
        tableName: 'bcflats_accounts',
        defaultScope: {
            attributes: { exclude: ['passwordHash'] }
        },
        scopes: {
            withHash: { attributes: {}, }
        }
    };

    const Account = sequelize.define('Account', attributes, options);
    
    Account.seedDefaults = async function() {
        const defaults = [
            {
                title: 'admin',
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@example.com',
                status: 'Active',
                role: 'Admin',
                password: 'admin123'
            },
            {
                title: 'superadmin',
                firstName: 'Super',
                lastName: 'Admin',
                email: 'superadmin@example.com',
                status: 'Active',
                role: 'SuperAdmin',
                password: 'superadmin123'
            },
            {
                title: 'accounting',
                firstName: 'Accounting',
                lastName: 'User',
                email: 'accounting@example.com',
                status: 'Active',
                role: 'Accounting',
                password: 'accounting123'
            }
        ];
        for (const user of defaults) {
            const hashedPassword = bcrypt.hashSync(user.password, 10);
            const { password, ...userWithoutPassword } = user;
            await Account.findOrCreate({
                where: { email: user.email },
                defaults: { 
                    ...userWithoutPassword, 
                    passwordHash: hashedPassword
                }
            });
        }
    };

    return Account;
};