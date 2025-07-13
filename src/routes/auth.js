const express = require('express');
const router = express.Router();
const AuthService = require('../services/authService');
const appKeyAuth = require('../middlewares/appKeyAuth');

// Register endpoint
router.post('/register', appKeyAuth, async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await AuthService.register(email, password);
        
        res.status(201).json({
            success: true,
            data: {
                email: result.user.email,
                token: result.token
            }
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Login endpoint
router.post('/login', appKeyAuth, async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await AuthService.login(email, password);
        
        res.status(200).json({
            success: true,
            data: {
                email: result.user.email,
                token: result.token
            }
        });
    } catch (error) {
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;