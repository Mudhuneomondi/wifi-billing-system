const express = require('express');
const router = express.Router();

const {
    initiateStk,
    mpesaCallback
} = require('../controllers/mpesaController');

// POST /api/mpesa/stk       -> start an STK push (frontend/captive portal calls this)
router.post('/stk', initiateStk);

// POST /api/mpesa/callback  -> Safaricom posts the payment result here
router.post('/callback', mpesaCallback);

module.exports = router;