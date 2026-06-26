const express = require('express');
const router = express.Router();

const { syncRouter } = require('../controllers/routerController');

// The RB941 polls this (GET) on a schedule.
// Full URL = <mount prefix>/sync  ->  /api/router/sync
router.get('/sync', syncRouter);

module.exports = router;