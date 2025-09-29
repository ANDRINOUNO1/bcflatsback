const config = require('../config.json');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../_helpers/db');

module.exports = {
    authenticate,
    refreshToken,
    revokeToken,
    getAll,
    getById,
    create,
    update,
    delete: _delete,
    // SuperAdmin management
    getPending,
    approveAccount,
    rejectAccount,
    setRole,
    setStatus
};

// ================= AUTH =================

async function authenticate({ email, password, ipAddress }) {
    const account = await db.Account.scope('withHash').findOne({ where: { email } });

    if (!account || !bcrypt.compareSync(password, account.passwordHash)) {
        throw 'Email or password is incorrect';
    }

    if (account.status !== 'Active') {
        throw 'Account is not active. Please contact support.';
    }

    // authentication successful
    const jwtToken = generateJwtToken(account);
    const refreshToken = await generateRefreshToken(account, ipAddress);

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: refreshToken.token
    };
}

async function refreshToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);
    const { account } = refreshToken;

    // replace old refresh token with a new one and save
    const newRefreshToken = await generateRefreshToken(account, ipAddress);
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    refreshToken.replacedByToken = newRefreshToken.token;
    await refreshToken.save();

    // generate new jwt
    const jwtToken = generateJwtToken(account);

    // return basic details and tokens
    return {
        ...basicDetails(account),
        jwtToken,
        refreshToken: newRefreshToken.token
    };
}
async function revokeToken({ token, ipAddress }) {
    const refreshToken = await getRefreshToken(token);

    // revoke token and save
    refreshToken.revoked = Date.now();
    refreshToken.revokedByIp = ipAddress;
    await refreshToken.save();
}




async function getAll() { 
    return await db.Account.findAll();
}

async function getById(id) {
    return await getAccount(id);
}

async function create(params) {
    // validate
    if (await db.Account.findOne({ where: { email: params.email } })) {
        throw 'Email "' + params.email + '" is already registered';
    }

    // default title when role is Accounting and title is missing/empty
    if (params && params.role === 'Accounting' && (!params.title || params.title.trim() === '')) {
        params.title = 'accounting';
    }

    const account = new db.Account(params);

    // hash password
    if (params.password) {
        account.passwordHash = bcrypt.hashSync(params.password, 10);
    }

    // save
    await account.save();
    return basicDetails(account);
}

async function update(id, params) {
    const account = await getAccount(id);

    // validate (email)
    if (params.email && account.email !== params.email) {
        if (await db.Account.findOne({ where: { email: params.email } })) {
            throw 'Email "' + params.email + '" is already registered';
        }
    }

    // hash password if entered
    if (params.password) {
        params.passwordHash = bcrypt.hashSync(params.password, 10);
    }

    Object.assign(account, params);
    account.updated = Date.now();
    await account.save();

    return basicDetails(account);
}

async function _delete(id) {
    const account = await getAccount(id);
    await account.destroy();
}

// ================= SuperAdmin Management =================

async function getPending() {
    return await db.Account.findAll({ where: { status: 'Pending' } });
}

async function approveAccount(id) {
    const account = await getAccount(id);
    account.status = 'Active';
    account.updated = Date.now();
    await account.save();
    return basicDetails(account);
}

async function rejectAccount(id, reason) {
    const account = await getAccount(id);
    account.status = 'Rejected';
    account.updated = Date.now();
    await account.save();
    return { ...basicDetails(account), rejectionReason: reason || null };
}

async function setRole(id, role) {
    const allowedRoles = ['Admin', 'SuperAdmin', 'Tenant', 'Accounting'];
    if (!allowedRoles.includes(role)) {
        throw 'Invalid role';
    }
    const account = await getAccount(id);
    account.role = role;
    account.updated = Date.now();
    await account.save();
    return basicDetails(account);
}

async function setStatus(id, status) {
    const allowedStatuses = ['Active', 'Pending', 'Suspended', 'Deleted', 'Rejected'];
    if (!allowedStatuses.includes(status)) {
        throw 'Invalid status';
    }
    const account = await getAccount(id);
    account.status = status;
    account.updated = Date.now();
    await account.save();
    return basicDetails(account);
}

// ================= HELPER FUNCTIONS =================

function generateJwtToken(account) {
    // create a jwt token valid for 15 minutes
    return jwt.sign({ id: account.id, role: account.role }, config.secret, { expiresIn: '1h' });
}

async function generateRefreshToken(account, ipAddress) {
    return await db.RefreshToken.create({
        accountId: account.id,
        token: crypto.randomBytes(40).toString('hex'),
        expires: new Date(Date.now() + 7*24*60*60*1000), // 7 days
        createdByIp: ipAddress
    });
}

async function getRefreshToken(token) {
    // FIX: Use db.RefreshToken and db.Account directly
    const refreshToken = await db.RefreshToken.findOne({ where: { token }, include: 'Account' });
    if (!refreshToken || !refreshToken.isActive) throw 'Invalid token';
    return refreshToken;
}
async function getAccount(id) {
    const account = await db.Account.findByPk(id);
    if (!account) throw 'Account not found';
    return account;
}

function basicDetails(account) {
    const { id, title, firstName, lastName, email, role, status, created, updated } = account;
    return { id, title, firstName, lastName, email, role, status, created, updated };
}
