const pool = require('../config/database');

const initializeStripe = () => {
    try {

    } catch (error) {
        console.error('Error initializing Stripe:', error);
        return ;

    }

  
};


module.exports = {
  initializeStripe: initializeStripe,
};