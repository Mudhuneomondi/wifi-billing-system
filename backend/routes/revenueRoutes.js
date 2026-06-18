const express = require('express');
const router = express.Router();

const {
    getTotalRevenue,
    getTodayRevenue,
    getMonthlyRevenue,
    getTopPackages
} = require('../controllers/revenueController');

const verifyToken = require('../middleware/authMiddleware');


// Admin analytics endpoints
router.get('/total', verifyToken, getTotalRevenue);
router.get('/today', verifyToken, getTodayRevenue);
router.get('/month', verifyToken, getMonthlyRevenue);
router.get('/top-packages', verifyToken, getTopPackages);

module.exports = router;