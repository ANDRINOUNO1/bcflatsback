const { expressjwt } = require('express-jwt');
const config = require('../config.json');
const db = require('../_helpers/db');

module.exports = authorize;

function authorize(roles = []) {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return [
        // Verify JWT
        expressjwt({ secret: config.secret, algorithms: ['HS256'] }),

        // Authorization logic
        async (req, res, next) => {
            try {
                console.log(' Authorization check for user ID:', req.auth?.id);
                console.log(' Required roles:', roles);
                
                const account = await db.Account.findByPk(req.auth.id);

                if (!account) {
                    console.log(' Account not found for ID:', req.auth?.id);
                    return res.status(401).json({ message: 'Unauthorized - Account not found' });
                }

                console.log(' Account found:', account.email, 'Role:', account.role, 'Status:', account.status);

                if (account.status !== 'Active') {
                    console.log(' Account inactive:', account.status);
                    return res.status(403).json({ message: 'Account is inactive or pending. Please contact support.' });
                }

                if (roles.length && !roles.includes(account.role)) {
                    console.log(' Insufficient role. Required:', roles, 'User has:', account.role);
                    return res.status(403).json({ message: 'Forbidden - Insufficient role' });
                }

                console.log(' Authorization successful for:', account.email);
                req.user = account;
                next();
            } catch (error) {
                console.error(' Authorization error:', error);
                return res.status(500).json({ message: 'Internal Server Error' });
            }
        }
    ];
}
