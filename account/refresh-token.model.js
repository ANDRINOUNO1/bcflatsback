const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const RefreshToken = sequelize.define('RefreshToken', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        token: {
            type: DataTypes.STRING,
            allowNull: false
        },
        expires: {
            type: DataTypes.DATE,
            allowNull: false
        },
        accountId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'bcflats_accounts',
                key: 'id'
            }
        }
    }, {
        tableName: 'bcflats_refresh_tokens',
        timestamps: true
    });

    return RefreshToken;
};