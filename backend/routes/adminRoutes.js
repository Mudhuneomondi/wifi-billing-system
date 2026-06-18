const express = require('express');
const router = express.Router();

const { getStats } = require('../controllers/adminController');

const verifyToken = require('../middleware/authMiddleware');
const sessionCheck = require('../middleware/sessionMiddleware');


// =====================================
// ADMIN STATS DASHBOARD
// =====================================
router.get(
    '/stats',
    verifyToken,
    sessionCheck,
    getStats
);

module.exports = router;