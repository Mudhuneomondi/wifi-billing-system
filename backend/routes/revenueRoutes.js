const express = require('express');
const router = express.Router();

const {
    getTotalRevenue,
    getTodayRevenue,
    getMonthlyRevenue,
    getTopPackages
} = require('../controllers/revenueController');

const { verifyAdmin } = require('../middleware/authMiddleware');

// Admin analytics endpoints -- previously used plain verifyToken, which
// only checks that a token is valid, not that it belongs to an admin.
// A logged-in WiFi customer's token would have passed that check and
// been able to view total/today/monthly revenue. verifyAdmin requires
// the role: 'admin' claim instead.
router.get('/total', verifyAdmin, getTotalRevenue);
router.get('/today', verifyAdmin, getTodayRevenue);
router.get('/month', verifyAdmin, getMonthlyRevenue);
router.get('/top-packages', verifyAdmin, getTopPackages);

module.exports = router;