const express = require('express');
const router = express.Router();

const {
    initiateStk,
    createPhonePurchase,
    getPaymentStatus,
    lookupByPhone,
    mpesaCallback
} = require('../controllers/mpesaController');

// POST /api/mpesa/stk        -> renew/extend an EXISTING account (has a user_id already)
router.post('/stk', initiateStk);

// POST /api/mpesa/purchase   -> walk-up buyer with just a phone number (captive portal "Buy a bundle")
router.post('/purchase', createPhonePurchase);

// GET  /api/mpesa/status/:checkout_request_id -> portal polls this after Pay is tapped
router.get('/status/:checkout_request_id', getPaymentStatus);

// GET  /api/mpesa/lookup/:phone -> "Forgot your code?" recovery, no SMS needed
router.get('/lookup/:phone', lookupByPhone);

// POST /api/mpesa/callback   -> Safaricom posts the payment result here
router.post('/callback', mpesaCallback);

module.exports = router;