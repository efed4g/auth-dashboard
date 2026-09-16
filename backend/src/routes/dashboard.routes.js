const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const controller = require('../controllers/dashboard.controller');
const { requireAuth, requireRoles } = require('../middleware/auth.middleware');

const router = express.Router();

router.get('/dashboard', requireAuth, asyncHandler(controller.getDashboard));

router.get(
  '/admin/users',
  requireAuth,
  requireRoles('admin'),
  asyncHandler(controller.listUsers)
);

module.exports = router;
