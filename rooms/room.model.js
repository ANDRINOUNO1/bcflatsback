const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Room = sequelize.define('Room', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        roomNumber: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        floor: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        building: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'Main Building'
        },
        roomType: {
            type: DataTypes.ENUM('Standard', 'Premium', 'Deluxe'),
            defaultValue: 'Standard'
        },
        status: {
            type: DataTypes.ENUM('Available', 'Partially Occupied', 'Fully Occupied', 'Maintenance', 'Reserved'),
            defaultValue: 'Available'
        },
        monthlyRent: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            comment: 'Monthly rent price for the entire room'
        },
        utilities: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: 0.00,
            comment: 'Monthly utilities price for the entire room'
        },
        totalBeds: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 4
        },
        occupiedBeds: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        availableBeds: {
            type: DataTypes.VIRTUAL,
            get() {
                return this.totalBeds - this.occupiedBeds;
            }
        },
        occupancyRate: {
            type: DataTypes.VIRTUAL,
            get() {
                return Math.round((this.occupiedBeds / this.totalBeds) * 100);
            }
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        amenities: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: []
        }
    }, {
        tableName: 'rooms',
        timestamps: true,
        hooks: {
            beforeValidate: (room) => {
                // Ensure occupiedBeds doesn't exceed totalBeds
                if (room.occupiedBeds > room.totalBeds) {
                    room.occupiedBeds = room.totalBeds;
                }
                
                // Update status based on occupancy
                if (room.occupiedBeds === 0) {
                    room.status = 'Available';
                } else if (room.occupiedBeds === room.totalBeds) {
                    room.status = 'Fully Occupied';
                } else {
                    room.status = 'Partially Occupied';
                }
            }
        }
    });

    // Instance methods
    Room.prototype.addTenant = async function() {
        if (this.occupiedBeds < this.totalBeds) {
            this.occupiedBeds += 1;
            await this.save();
            return true;
        }
        return false;
    };

    Room.prototype.removeTenant = async function() {
        if (this.occupiedBeds > 0) {
            this.occupiedBeds -= 1;
            await this.save();
            return true;
        }
        return false;
    };

    Room.prototype.isAvailable = function() {
        return this.occupiedBeds < this.totalBeds && this.status !== 'Maintenance';
    };

    Room.prototype.getNextAvailableBed = function() {
        return this.occupiedBeds + 1;
    };

    // Class methods
    Room.findAvailableRooms = function() {
        return this.findAll({
            where: {
                status: ['Available', 'Partially Occupied']
            },
            order: [['roomNumber', 'ASC']]
        });
    };

    Room.findRoomsByStatus = function(status) {
        return this.findAll({
            where: { status },
            order: [['roomNumber', 'ASC']]
        });
    };

    Room.getRoomStats = async function() {
        const totalRooms = await this.count();
        const availableRooms = await this.count({ where: { status: 'Available' } });
        const fullyOccupiedRooms = await this.count({ where: { status: 'Fully Occupied' } });
        const partiallyOccupiedRooms = await this.count({ where: { status: 'Partially Occupied' } });
        const maintenanceRooms = await this.count({ where: { status: 'Maintenance' } });

        const totalBeds = totalRooms * 4; // 4 beds per room
        const occupiedBeds = (fullyOccupiedRooms * 4) + 
                           (await this.sum('occupiedBeds', { where: { status: 'Partially Occupied' } }) || 0);

        return {
            totalRooms,
            availableRooms,
            fullyOccupiedRooms,
            partiallyOccupiedRooms,
            maintenanceRooms,
            totalBeds,
            occupiedBeds,
            availableBeds: totalBeds - occupiedBeds,
            occupancyRate: Math.round((occupiedBeds / totalBeds) * 100)
        };
    };

    // Seeder method - Updated for 8 floors (2nd to 9th) with 9 rooms per floor
    Room.seedDefaults = async function() {
        const defaults = [];
        
        // Create 72 rooms (8 floors × 9 rooms per floor) - Floors 2 to 9
        for (let floor = 2; floor <= 9; floor++) {
            for (let room = 1; room <= 9; room++) {
                const roomNumber = `${floor}${room.toString().padStart(2, '0')}`;
                
                // Base pricing structure (in Philippine Peso):
                // - Higher floors cost more (better view, less noise)
                // - Room numbers 1-3: Standard pricing
                // - Room numbers 4-6: Premium pricing (+10%)
                // - Room numbers 7-9: Deluxe pricing (+20%)
                let baseRent = 25000 + (floor * 1500); // Base rent increases with floor
                let baseUtilities = 3500 + (floor * 200); // Utilities increase slightly with floor
                
                let roomType = 'Standard';
                if (room >= 4 && room <= 6) {
                    baseRent *= 1.1; // 10% premium
                    baseUtilities *= 1.05; // 5% premium
                    roomType = 'Premium';
                } else if (room >= 7) {
                    baseRent *= 1.2; // 20% premium
                    baseUtilities *= 1.1; // 10% premium
                    roomType = 'Deluxe';
                }
                
                // Add some variation based on room number
                baseRent += (room * 500);
                baseUtilities += (room * 100);
                
                defaults.push({
                    roomNumber,
                    floor,
                    building: 'Main Building',
                    roomType,
                    status: 'Available',
                    monthlyRent: Math.round(baseRent),
                    utilities: Math.round(baseUtilities),
                    totalBeds: 4,
                    occupiedBeds: 0,
                    description: `Room ${roomNumber} - ${floor}${floor === 1 ? 'st' : floor === 2 ? 'nd' : floor === 3 ? 'rd' : 'th'} floor, ${roomType} room`,
                    amenities: ['WiFi', 'Air Conditioning', 'Furnished', 'Private Bathroom', 'Study Desk', 'Wardrobe']
                });
            }
        }

        for (const room of defaults) {
            await Room.findOrCreate({
                where: { roomNumber: room.roomNumber },
                defaults: room
            });
        }
    };

    return Room;
};
