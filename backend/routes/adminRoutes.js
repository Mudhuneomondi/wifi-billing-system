const express = require('express');
const router = express.Router();

const { getStats } = require('../controllers/adminController');
const { adminLogin, createAdmin } = require('../controllers/adminAuthController');
const { verifyAdmin } = require('../middleware/authMiddleware');

// =====================================
// ADMIN AUTH
// =====================================
router.post('/login', adminLogin);
router.post('/create', createAdmin); // one-time bootstrap, gated by ADMIN_SETUP_KEY

// =====================================
// ADMIN STATS DASHBOARD
// =====================================
// Previously gated by sessionCheck, which checks for an ACTIVE WIFI
// HOTSPOT SESSION -- the wrong concept for "is this an admin". Swapped
// for verifyAdmin, which checks the JWT's role claim instead.
router.get(
    '/stats',
    verifyAdmin,
    getStats
);

module.exports = router;