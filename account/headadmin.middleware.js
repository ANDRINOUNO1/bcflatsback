const jwt = require('jsonwebtoken');
const config = require('../config.json');
const db = require('../_helpers/db');

module.exports = {
    requireHeadAdmin
};

// Middleware to require Head Admin role
function requireHeadAdmin() {
    return [
        async (req, res, next) => {
            try {
                const authHeader = req.headers.authorization;
                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return res.status(401).json({ message: 'Authentication required' });
                }

                const token = authHeader.substring(7);
                const decoded = jwt.verify(token, config.secret);
                
                const account = await db.Account.findByPk(decoded.id);
                if (!account || account.status !== 'Active') {
                    return res.status(401).json({ message: 'Authentication required' });
                }

                // Check if user is HeadAdmin
                if (account.role !== 'HeadAdmin') {
                    return res.status(403).json({ 
                        message: 'Head Admin role required'
                    });
                }

                req.user = account;
                next();
            } catch (error) {
                return res.status(401).json({ message: 'Authentication required' });
            }
        }
    ];
}
