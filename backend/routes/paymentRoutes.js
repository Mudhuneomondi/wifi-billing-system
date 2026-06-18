const express = require('express');
const router = express.Router();

const { getPayments } = require('../controllers/paymentController');

const verifyToken = require('../middleware/authMiddleware');

router.get(
    '/',
    verifyToken,
    getPayments
);

module.exports = router;