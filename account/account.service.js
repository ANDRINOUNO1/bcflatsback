const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config.json'); // store jwt secret here
const db = require('../_helpers/db'); // assumes db.js loads all models
const Role = require('../_helpers/role'); // your role definitions

module.exports = {
    authenticate,
    getAll,
    getById,
    create,
    update,
    delete: _delete,
};


function omitHash(account) {
    const { passwordHash, ...accountWithoutHash } = account;
    return accountWithoutHash;
}


async function authenticate({ email, password }) {
    const account = await db.Account.scope('withHash').findOne({ where: { email } });
    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
        throw 'Email or password is incorrect';
    }

    const token = jwt.sign({ sub: account.id, role: account.role }, config.secret, { expiresIn: '7d' });
    return { ...omitHash(account.get()), token };
}

// Get all users
async function getAll() {
    return await db.Account.findAll();
}

//  Get user by id
async function getById(id) {
    return await getAccount(id);
}

//  Create new account
async function create(params) {
    // check email
    if (await db.Account.findOne({ where: { email: params.email } })) {
        throw `Email "${params.email}" is already taken`;
    }

    // hash password
    if (params.password) {
        params.passwordHash = await bcrypt.hash(params.password, 10);
    }

    const account = new db.Account(params);
    await account.save();
}

//  Update account
async function update(id, params) {
    const account = await getAccount(id);

    // check email (if changed)
    if (params.email && account.email !== params.email) {
        if (await db.Account.findOne({ where: { email: params.email } })) {
            throw `Email "${params.email}" is already taken`;
        }
    }

    // hash password if provided
    if (params.password) {
        params.passwordHash = await bcrypt.hash(params.password, 10);
    }

    // copy params
    Object.assign(account, params);
    await account.save();
}

//  Delete account
async function _delete(id) {
    const account = await getAccount(id);
    await account.destroy();
}

// helper
async function getAccount(id) {
    const account = await db.Account.findByPk(id);
    if (!account) throw 'Account not found';
    return account;
}

