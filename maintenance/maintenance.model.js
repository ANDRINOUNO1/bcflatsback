const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Maintenance = sequelize.define('Maintenance', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenantId: { type: DataTypes.INTEGER, allowNull: false },
    roomId: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    priority: { type: DataTypes.ENUM('Low', 'Medium', 'High'), defaultValue: 'Low' },
    status: { type: DataTypes.ENUM('Pending', 'Ongoing', 'Fixed'), defaultValue: 'Pending' }
  }, {
    tableName: 'maintenance_requests',
    timestamps: true
  });

  return Maintenance;
};


