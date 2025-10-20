const db = require('../_helpers/db');
const notificationHelper = require('../notifications/notification.helper');

module.exports = {
  createRequest,
  listAll,
  listByTenant,
  updateStatus,
  getById
};

async function createRequest({ tenantId, roomId, title, description, priority = 'Low' }) {
  const tenant = await db.Tenant.findByPk(tenantId);
  if (!tenant) throw new Error('Tenant not found');
  const room = await db.Room.findByPk(roomId);
  if (!room) throw new Error('Room not found');
  const request = await db.Maintenance.create({ tenantId, roomId, title, description, priority });
  
  // Send notification
  try {
    await notificationHelper.notifyMaintenanceRequestCreated(request, tenant);
  } catch (e) {
    console.warn('Failed to send maintenance notification:', e.message);
  }
  
  return request;
}

async function listAll() {
  return db.Maintenance.findAll({ order: [['createdAt','DESC']] });
}

async function listByTenant(tenantId) {
  return db.Maintenance.findAll({ where: { tenantId }, order: [['createdAt','DESC']] });
}

async function updateStatus(id, status) {
  const item = await db.Maintenance.findByPk(id);
  if (!item) return null;
  const oldStatus = item.status;
  item.status = status || item.status;
  await item.save();
  
  // Send notification if status changed
  try {
    if (oldStatus !== status) {
      const tenant = await db.Tenant.findByPk(item.tenantId);
      if (tenant) {
        await notificationHelper.notifyMaintenanceStatusChanged(item, tenant, oldStatus, status);
      }
    }
  } catch (e) {
    console.warn('Failed to send maintenance status notification:', e.message);
  }
  
  return item;
}

async function getById(id) {
  return db.Maintenance.findByPk(id);
}


