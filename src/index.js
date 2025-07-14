const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { checkAndPrepareCollection } = require('./services/enjinService');

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/token', require('./routes/token'));

// Basic error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal Server Error'
    });
});

const PORT = process.env.PORT || 3000;

// Start server after checking collection
checkAndPrepareCollection()
    .then(() => {
        console.log(`Collection and resource tokens are ready. Using collection ID: ${process.env.ENJIN_COLLECTION_ID}`);
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });