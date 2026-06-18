const express = require('express');
const router = express.Router();

const {
    createUser,
    loginUser,
    getUsers,
    getUserById,
    deleteUser,
    renewPackage
} = require('../controllers/userController');

const verifyToken = require('../middleware/authMiddleware');
const sessionCheck = require('../middleware/sessionMiddleware');


// ==========================
// PUBLIC ROUTES
// ==========================
router.post('/register', createUser);
router.post('/login', loginUser);


// ==========================
// PROTECTED ROUTES
// ==========================
router.get('/', verifyToken, sessionCheck, getUsers);

router.get('/:id', verifyToken, sessionCheck, getUserById);

router.delete('/:id', verifyToken, sessionCheck, deleteUser);

router.post(
    '/renew/:id',
    verifyToken,
    sessionCheck,
    renewPackage
);


// ==========================
// EXPORT
// ==========================
module.exports = router;