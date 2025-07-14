const express = require('express');
const router = express.Router();
const axios = require('axios');
const appKeyAuth = require('../middlewares/appKeyAuth');
const jwtAuth = require('../middlewares/jwtAuth');
const { mintToken, burnToken, transferToken } = require('../services/enjinService');

// Middleware chain for token operations
const tokenMiddleware = [appKeyAuth, jwtAuth];

// Mint token endpoint
router.post('/mint', tokenMiddleware, async (req, res) => {
    try {
        await mintToken(req.body.tokenId, req.body.recipient, req.body.amount)

        res.json({
            success: true
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Burn token endpoint
router.post('/burn', tokenMiddleware, async (req, res) => {
    try {
        await burnToken(req.body.tokenId, req.body.recipient, req.body.amount)

        res.json({
            success: true
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Transfer token endpoint
router.post('/transfer', tokenMiddleware, async (req, res) => {
    try {
        await transferToken(req.body.tokenId, req.body.recipient, req.body.amount)

        res.json({
            success: true
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;