module.exports = (sequelize, DataTypes) => {
    const attributes = {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: DataTypes.STRING, allowNull: true },
        firstName: { type: DataTypes.STRING, allowNull: false },
        lastName: { type: DataTypes.STRING, allowNull: false },
        email: { type: DataTypes.STRING, allowNull: false, unique: true },
        passwordHash: { type: DataTypes.STRING, allowNull: false },
        status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Pending' },
        role: { 
            type: DataTypes.STRING, 
            allowNull: false, 
            defaultValue: Role.User,
            validate: {
                isIn: [[Role.Admin, Role.User, Role.SuperAdmin, Role.Owner]]
            }
        },
        created: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        updated: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
    };

    const options = {
        timestamps: false,
        tableName: 'Accounts',
        defaultScope: {
            attributes: { exclude: ['passwordHash'] }
        },
        scopes: {
            withHash: { attributes: {}, }
        }
    };

    const Account = sequelize.define('Account', attributes, options);
    
    // Seeder
    Account.seedDefaults = async function() {
        const defaults = [
            {
                title: 'superadmin',
                firstName: 'Super',
                lastName: 'Admin',
                email: 'superadmin@example.com',
                status: 'Active',
                role: Role.SuperAdmin,
                password: 'superadmin123'
            },
            {
                title: 'admin',
                firstName: 'Admin',
                lastName: 'User',
                email: 'admin@example.com',
                status: 'Active',
                role: Role.Admin,
                password: 'admin123'
            },
            {
                title: 'owner',
                firstName: 'System',
                lastName: 'Owner',
                email: 'owner@example.com',
                status: 'Active',
                role: Role.Owner,
                password: 'owner123'
            },
            {
                title: 'user',
                firstName: 'Normal',
                lastName: 'User',
                email: 'user@example.com',
                status: 'Active',
                role: Role.User,
                password: 'user123'
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