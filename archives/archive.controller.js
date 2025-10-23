const express = require('express');
const router = express.Router();
const archiveService = require('./archive.service');
const authorize = require('../_middleware/authorize');

// Protected routes (require authentication)
router.get('/list', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), getArchivedTenants);
router.get('/stats', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), getArchiveStats);
router.post('/archive/:tenantId', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), archiveTenant);
router.post('/restore/:archiveId', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), restoreTenant);
router.delete('/:archiveId', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), deleteArchive);

module.exports = router;

// Controller functions
async function getArchivedTenants(req, res, next) {
    try {
        const options = {
            page: req.query.page || 1,
            limit: req.query.limit || 50,
            sortBy: req.query.sortBy || 'checkOutDate',
            sortOrder: req.query.sortOrder || 'DESC',
            search: req.query.search || '',
            startDate: req.query.startDate || null,
            endDate: req.query.endDate || null
        };

        const result = await archiveService.getArchivedTenants(options);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

async function getArchiveStats(req, res, next) {
    try {
        const stats = await archiveService.getArchiveStats();
        res.json(stats);
    } catch (error) {
        next(error);
    }
}

async function archiveTenant(req, res, next) {
    try {
        const { tenantId } = req.params;
        const { archiveReason } = req.body;
        const archivedBy = req.user.id;

        const archive = await archiveService.archiveTenant(tenantId, archivedBy, archiveReason);
        res.status(201).json(archive);
    } catch (error) {
        next(error);
    }
}

async function restoreTenant(req, res, next) {
    try {
        const { archiveId } = req.params;
        const restoredBy = req.user.id;

        const result = await archiveService.restoreTenant(archiveId, restoredBy);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

async function deleteArchive(req, res, next) {
    try {
        const { archiveId } = req.params;
        const result = await archiveService.deleteArchive(archiveId);
        res.json(result);
    } catch (error) {
        next(error);
    }
}
