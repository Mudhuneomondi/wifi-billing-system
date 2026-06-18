const express = require('express');
const router = express.Router();

const {
    getActiveSessions,
    disconnectSession
} = require('../controllers/sessionController');

const verifyToken = require('../middleware/authMiddleware');
const sessionCheck = require('../middleware/sessionMiddleware');

router.get(
    '/active',
    verifyToken,
    sessionCheck,
    getActiveSessions
);

router.post(
    '/disconnect/:id',
    verifyToken,
    sessionCheck,
    disconnectSession
);

module.exports = router;