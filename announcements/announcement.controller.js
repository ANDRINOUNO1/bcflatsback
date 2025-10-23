const express = require('express');
const router = express.Router();
const announcementService = require('./announcement.service');
const authorize = require('../_middleware/authorize');

// Protected routes (require authentication)
router.get('/', ...authorize(), getAnnouncements);
router.get('/stats', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), getAnnouncementStats);
router.get('/:id', ...authorize(), getAnnouncementById);
router.post('/', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), createAnnouncement);
router.put('/:id', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), updateAnnouncement);
router.delete('/:id', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), deleteAnnouncement);
router.post('/:id/publish', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), publishAnnouncement);
router.post('/:id/suspend', ...authorize(['Admin', 'SuperAdmin', 'HeadAdmin']), suspendAnnouncement);
router.post('/:id/read', ...authorize(), markAsRead);

module.exports = router;

// Controller functions
async function getAnnouncements(req, res, next) {
    try {
        const options = {
            page: req.query.page || 1,
            limit: req.query.limit || 50,
            status: req.query.status || null,
            priority: req.query.priority || null,
            role: req.query.role || req.user.role, // Default to user's role
            search: req.query.search || '',
            sortBy: req.query.sortBy || 'createdAt',
            sortOrder: req.query.sortOrder || 'DESC'
        };

        const result = await announcementService.getAnnouncements(options);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

async function getAnnouncementStats(req, res, next) {
    try {
        const stats = await announcementService.getAnnouncementStats();
        res.json(stats);
    } catch (error) {
        next(error);
    }
}

async function getAnnouncementById(req, res, next) {
    try {
        const announcement = await announcementService.getAnnouncementById(req.params.id);
        res.json(announcement);
    } catch (error) {
        next(error);
    }
}

async function createAnnouncement(req, res, next) {
    try {
        const announcementData = {
            ...req.body,
            createdBy: req.user.id
        };

        const announcement = await announcementService.createAnnouncement(announcementData);
        res.status(201).json(announcement);
    } catch (error) {
        next(error);
    }
}

async function updateAnnouncement(req, res, next) {
    try {
        const announcement = await announcementService.updateAnnouncement(req.params.id, req.body);
        res.json(announcement);
    } catch (error) {
        next(error);
    }
}

async function deleteAnnouncement(req, res, next) {
    try {
        const result = await announcementService.deleteAnnouncement(req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
}

async function publishAnnouncement(req, res, next) {
    try {
        const announcement = await announcementService.publishAnnouncement(req.params.id);
        res.json(announcement);
    } catch (error) {
        next(error);
    }
}

async function suspendAnnouncement(req, res, next) {
    try {
        const announcement = await announcementService.suspendAnnouncement(req.params.id);
        res.json(announcement);
    } catch (error) {
        next(error);
    }
}

async function markAsRead(req, res, next) {
    try {
        const result = await announcementService.markAsRead(req.params.id, req.user.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
}
