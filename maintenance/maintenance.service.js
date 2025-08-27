const db = require('../_helpers/db');

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
  item.status = status || item.status;
  await item.save();
  return item;
}

async function getById(id) {
  return db.Maintenance.findByPk(id);
}


