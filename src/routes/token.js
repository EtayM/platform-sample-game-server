const express = require('express');
const router = express.Router();
const axios = require('axios');
const appKeyAuth = require('../middlewares/appKeyAuth');
const jwtAuth = require('../middlewares/jwtAuth');

// Middleware chain for token operations
const tokenMiddleware = [appKeyAuth, jwtAuth];

// Mint token endpoint
router.post('/mint', tokenMiddleware, async (req, res) => {
    try {
        const response = await axios.post(process.env.ENJIN_API_URL, {
            query: `mutation CreateCollection($forceCollapsingSupply: Boolean) {
                CreateCollection(
                    mintPolicy: { forceCollapsingSupply: $forceCollapsingSupply }
                ) {
                    id
                    method
                    state
                }
            }`,
            variables: {
                forceCollapsingSupply: false
            }
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': process.env.ENJIN_API_KEY
            }
        });

        res.json({
            success: true,
            data: response.data
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
        const response = await axios.post(process.env.ENJIN_API_URL, {
            // Placeholder for burn mutation
            query: `mutation BurnToken {
                // Add your burn mutation here
            }`,
            variables: req.body
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': process.env.ENJIN_API_KEY
            }
        });

        res.json({
            success: true,
            data: response.data
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
        const response = await axios.post(process.env.ENJIN_API_URL, {
            // Placeholder for transfer mutation
            query: `mutation TransferToken {
                // Add your transfer mutation here
            }`,
            variables: req.body
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': process.env.ENJIN_API_KEY
            }
        });

        res.json({
            success: true,
            data: response.data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;