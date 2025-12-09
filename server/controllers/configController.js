const dotenv = require('dotenv');

dotenv.config();


exports.stripeKey = (req,res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    })
}