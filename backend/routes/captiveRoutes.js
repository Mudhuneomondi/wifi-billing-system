const express = require('express');
const router = express.Router();

const {
    captiveLogin
} = require('../controllers/captiveController');

router.post('/login', captiveLogin);

module.exports = router;