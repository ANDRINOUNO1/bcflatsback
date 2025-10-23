const { DataTypes } = require('sequelize');
const { literal } = require('sequelize');

module.exports = (sequelize) => {
    const Announcement = sequelize.define('Announcement', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                notEmpty: true,
                len: [1, 255]
            }
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        targetRoles: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
            comment: 'Array of roles to receive this announcement (Tenant, Admin, etc.)'
        },
        priority: {
            type: DataTypes.ENUM('Low', 'Medium', 'High', 'Critical'),
            allowNull: false,
            defaultValue: 'Medium'
        },
        status: {
            type: DataTypes.ENUM('Draft', 'Published', 'Suspended', 'Expired'),
            allowNull: false,
            defaultValue: 'Draft'
        },
        scheduledAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When to publish the announcement (null = immediate)'
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'When the announcement expires (null = never expires)'
        },
        createdBy: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'bcflats_accounts',
                key: 'id'
            }
        },
        metadata: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: {},
            comment: 'Additional data like attachments, links, etc.'
        },
        readBy: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: [],
            comment: 'Array of account IDs who have read this announcement'
        },
        readCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            comment: 'Total number of times this announcement has been read'
        }
    }, {
        tableName: 'bcflats_announcements',
        timestamps: true,
        indexes: [
            { fields: ['status'] },
            { fields: ['priority'] },
            { fields: ['createdBy'] },
            { fields: ['scheduledAt'] },
            { fields: ['expiresAt'] },
            { fields: ['createdAt'] }
        ]
    });

    // Instance methods
    Announcement.prototype.isPublished = function() {
        return this.status === 'Published';
    };

    Announcement.prototype.isExpired = function() {
        if (!this.expiresAt) return false;
        return new Date() > new Date(this.expiresAt);
    };

    Announcement.prototype.isScheduled = function() {
        if (!this.scheduledAt) return false;
        return new Date() < new Date(this.scheduledAt);
    };

    Announcement.prototype.canBeRead = function() {
        return this.isPublished() && !this.isExpired() && !this.isScheduled();
    };

    Announcement.prototype.markAsRead = async function(accountId) {
        if (!this.readBy.includes(accountId)) {
            this.readBy = [...this.readBy, accountId];
            this.readCount += 1;
            await this.save();
        }
        return this;
    };

    Announcement.prototype.getUnreadCount = async function() {
        const totalTargetAccounts = await sequelize.models.Account.count({
            where: {
                role: {
                    [sequelize.Sequelize.Op.in]: this.targetRoles
                }
            }
        });
        return totalTargetAccounts - this.readCount;
    };

    // Class methods
    Announcement.findActive = function() {
        return this.findAll({
            where: {
                status: 'Published',
                [sequelize.Sequelize.Op.or]: [
                    { expiresAt: null },
                    { expiresAt: { [sequelize.Sequelize.Op.gt]: new Date() } }
                ],
                [sequelize.Sequelize.Op.or]: [
                    { scheduledAt: null },
                    { scheduledAt: { [sequelize.Sequelize.Op.lte]: new Date() } }
                ]
            },
            include: [
                { model: sequelize.models.Account, as: 'creator' }
            ],
            order: [['priority', 'DESC'], ['createdAt', 'DESC']]
        });
    };

    Announcement.findByRole = function(role) {
        return this.findAll({
            where: {
                status: 'Published',
                [sequelize.Sequelize.Op.and]: [
                    literal(`JSON_CONTAINS(targetRoles, '"${role}"')`)
                ],
                [sequelize.Sequelize.Op.or]: [
                    { expiresAt: null },
                    { expiresAt: { [sequelize.Sequelize.Op.gt]: new Date() } }
                ],
                [sequelize.Sequelize.Op.or]: [
                    { scheduledAt: null },
                    { scheduledAt: { [sequelize.Sequelize.Op.lte]: new Date() } }
                ]
            },
            include: [
                { model: sequelize.models.Account, as: 'creator' }
            ],
            order: [['priority', 'DESC'], ['createdAt', 'DESC']]
        });
    };

    Announcement.getStats = async function() {
        const total = await this.count();
        const published = await this.count({ where: { status: 'Published' } });
        const draft = await this.count({ where: { status: 'Draft' } });
        const suspended = await this.count({ where: { status: 'Suspended' } });
        const expired = await this.count({ where: { status: 'Expired' } });

        return {
            total,
            published,
            draft,
            suspended,
            expired
        };
    };

    Announcement.seedDefaults = async function() {
        console.log('Announcement seeder: No default announcements to create');
    };

    return Announcement;
};
