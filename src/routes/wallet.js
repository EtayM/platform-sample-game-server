const express = require('express');
const router = express.Router();
const axios = require('axios');
const appKeyAuth = require('../middlewares/appKeyAuth');
const jwtAuth = require('../middlewares/jwtAuth');
const { getManagedWallet, createManagedWallet } = require('../services/enjinService');

// Middleware chain for token operations
const tokenMiddleware = [appKeyAuth, jwtAuth];

// Get managed wallet endpoint
router.post('/get', tokenMiddleware, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const getManagedWalletResponse = await getManagedWallet(userEmail)
        if (!getManagedWalletResponse)
            throw new Error(`Failed to get managed wallet for external id ${userEmail}`);
        const wallet = getManagedWalletResponse.account.address;
        res.json({
            success: true,
            wallet: wallet
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Create and return managed wallet endpoint
router.post('/create', tokenMiddleware, async (req, res) => {
    try {
        const userEmail = req.user.email;
        const createManagedWalletResponse = await createManagedWallet(userEmail)
        if (!createManagedWalletResponse)
            throw new Error(`Failed to get managed wallet for external id ${userEmail}`);
        const wallet = createManagedWalletResponse.account.address;
        res.json({
            success: true,
            wallet: wallet
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;