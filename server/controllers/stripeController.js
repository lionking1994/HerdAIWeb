const User = require('../models/User');
const Product = require('../models/Product');
const Subscription = require('../models/Subscription');
const stripeConfig = require('../config/stripe');
const { handleError } = require('../utils/errorHandler');

/**
 * Create a Stripe customer for a user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createCustomer = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if user already has a Stripe customer ID
    const user = await User.findById(userId);
    if (process.env.STRIPE_ENVIRONMENT == 'production')
      if (user.stripe_customer_id_production) {
        return res.status(200).json({
          success: true,
          message: 'User already has a Stripe customer ID',
          customerId: user.stripe_customer_id_production
        });
      }
      else
        if (user.stripe_customer_id_sandbox) {
          return res.status(200).json({
            success: true,
            message: 'User already has a Stripe customer ID',
            customerId: user.stripe_customer_id_sandbox
          });
        }
    
    // Create a new Stripe customer
    const stripe = stripeConfig.getStripe();
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: userId.toString()
      }
    });
    
    // Update user with Stripe customer ID
    await User.updateStripeCustomerId(userId, customer.id);
    
    return res.status(201).json({
      success: true,
      customerId: customer.id
    });
  } catch (error) {
    return handleError(res, error, 'Failed to create Stripe customer');
  }
};

/**
 * Create a checkout session for subscription
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const userId = req.user.id;
    const { productIds } = req.body; // Changed from productId to productIds array
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one product ID is required'
      });
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get all selected products
    const products = await Promise.all(
      productIds.map(async (productId) => {
        const product = await Product.findById(productId);
        if (!product) {
          throw new Error(`Product with ID ${productId} not found`);
        }
        if (!product.active) {
          throw new Error(`Product ${product.name} is not available for purchase`);
        }
        return product;
      })
    );
    
    // Create or get Stripe customer
    let customerId = process.env.STRIPE_ENVIRONMENT == 'production' ? user.stripe_customer_id_production : user.stripe_customer_id_sandbox;
    if (!customerId) {
      const stripe = stripeConfig.getStripe();
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: userId.toString()
        }
      });
      customerId = customer.id;
      await User.updateStripeCustomerId(userId, customerId);
    }
    
    // Create line items for each product
    const line_items = products.map(product => ({
      price: product.default_price.id,
      quantity: 1
    }));

    // Create checkout session
    const stripe = stripeConfig.getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items,
      mode: 'subscription',
      success_url: `${stripeConfig.getClientUrl()}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${stripeConfig.getClientUrl()}/subscription/cancel`,
      customer: customerId,
      metadata: {
        userId: userId.toString(),
        productIds: JSON.stringify(productIds) // Store all product IDs in metadata
      }
    });
    
    return res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    return handleError(res, error, 'Failed to create checkout session');
  }
};

/**
 * Get user's subscriptions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's subscriptions
    const subscriptions = await Subscription.findAllByUserId(userId);
    
    return res.status(200).json({
      success: true,
      subscriptions
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get user subscriptions');
  }
};

/**
 * Create a billing portal session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createBillingPortalSession = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user has a Stripe customer ID
    if (!user.stripe_customer_id_production && !user.stripe_customer_id_sandbox) {
      return res.status(400).json({
        success: false,
        message: 'User does not have a Stripe customer ID'
      });
    }
    
    // Create billing portal session
    const stripe = stripeConfig.getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: process.env.STRIPE_ENVIRONMENT == 'production' ? user.stripe_customer_id_production : user.stripe_customer_id_sandbox,
      return_url: `${stripeConfig.getClientUrl()}/account`
    });
    
    return res.status(200).json({
      success: true,
      url: session.url
    });
  } catch (error) {
    return handleError(res, error, 'Failed to create billing portal session');
  }
};

/**
 * Handle Stripe webhook events
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = stripeConfig.getWebhookSecret();
  const stripe = stripeConfig.getStripe();
  
  let event;
  
  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      webhookSecret
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Get user ID and product IDs from metadata
        const userId = parseInt(session.metadata.userId);
        const productIds = JSON.parse(session.metadata.productIds);

        // Get subscription ID from session
        const subscriptionId = session.subscription;
        
        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        console.log('subscription:', subscription);
        // Create single subscription with all product IDs
        await Subscription.create({
          subscription_id: subscriptionId,
          user_id: userId,
          product_ids: productIds, // Save as array
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000),
          stripe_data: JSON.stringify(subscription)
        });
        
        // Reset meeting count for user
        await User.resetMeetingCount(userId);
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        
        // Update subscription in database
        await Subscription.updateData(
          subscription.id,
          subscription.status,
          new Date(subscription.current_period_end * 1000),
          JSON.stringify(subscription)
        );
        
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        // Update subscription status to canceled
        await Subscription.updateData(
          subscription.id,
          'canceled',
          new Date(subscription.current_period_end * 1000),
          JSON.stringify(subscription)
        );
        
        break;
      }
      
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        
        // Get subscription ID from invoice
        const subscriptionId = invoice.subscription;
        
        // Update subscription status to past_due
        await Subscription.updateData(
          subscriptionId,
          'past_due',
          null,
          JSON.stringify(invoice)
        );
        
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error handling webhook event:', error);
    return res.status(500).send(`Webhook Error: ${error.message}`);
  }
};


exports.getAdminSubscriptions = async (req, res) => {
  const { subscriptionUserId } = req.body;

  try {
    // First get subscriptions from database
    const subscriptions = await Subscription.findAllByUserId(subscriptionUserId);

    if (!subscriptions.length) {
      return res.status(200).json({
        success: true,
        subscriptions: []
      });
    }

    // Get Stripe instance
    const stripe = stripeConfig.getStripe();

    // Fetch all subscriptions from Stripe
    const detailedSubscriptions = await Promise.all(
      subscriptions.map(async (dbSub) => {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(dbSub.subscription_id, {
            expand: ['items.data.price.product']
          });

          // Get products information for all product IDs
          const products = await Promise.all(
            dbSub.product_ids.map(async (productId) => {
              const product = await Product.findById(productId);
              return product;
            })
          );

          return {
            ...dbSub,
            stripe_status: stripeSub.status,
            current_period_start: new Date(stripeSub.current_period_start * 1000),
            current_period_end: new Date(stripeSub.current_period_end * 1000),
            cancel_at_period_end: stripeSub.cancel_at_period_end,
            products: products.map(product => ({
              id: product.id,
              name: product.name,
              description: product.description,
              price: {
                amount: product.default_price.unit_amount,
                currency: 'usd',
                interval: product.default_price.recurring.interval
              }
            }))
          };
        } catch (error) {
          return {
            ...dbSub,
            stripe_error: error.message
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      subscriptions: detailedSubscriptions
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get user subscriptions');
  }
};

// Add a method to cancel subscription
exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const userId = req.user.id;

    // Verify subscription belongs to user
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || subscription.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this subscription'
      });
    }

    const stripe = stripeConfig.getStripe();

    // Cancel immediately
    await stripe.subscriptions.cancel(subscriptionId);

    // Update local subscription status
    await Subscription.updateStatus(subscriptionId, 'canceled');

    return res.status(200).json({
      success: true,
      message: 'Subscription will be canceled at the end of the billing period'
    });
  } catch (error) {
    return handleError(res, error, 'Failed to cancel subscription');
  }
};

/**
 * Verify a checkout session and return its status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.verifySession = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user.id;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    const stripe = stripeConfig.getStripe();

    let session;
    try {
      // Retrieve the checkout session with expanded subscription data
      session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: [
          'subscription',
          'payment_intent',
          'setup_intent',
          'customer'
        ]
      });
    } catch (stripeError) {
      if (stripeError.type === 'StripeInvalidRequestError') {
        return res.status(404).json({
          success: false,
          message: 'Invalid or expired session ID',
          error: stripeError.message
        });
      }
      throw stripeError; // Re-throw other Stripe errors
    }

    // Verify the session belongs to the user
    if (!session.metadata || session.metadata.userId !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to this session'
      });
    }

    // Get subscription details if available
    let subscriptionDetails = null;
    if (session.subscription) {
      try {
        const subscription = await stripe.subscriptions.retrieve(session.subscription.id, {
          expand: ['items.data.price.product']
        });

        subscriptionDetails = {
          id: subscription.id,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000),
          current_period_end: new Date(subscription.current_period_end * 1000),
          cancel_at_period_end: subscription.cancel_at_period_end,
          items: subscription.items.data.map(item => ({
            product: {
              id: item.price.product.id,
              name: item.price.product.name
            },
            price: {
              id: item.price.id,
              unit_amount: item.price.unit_amount,
              currency: item.price.currency,
              interval: item.price.recurring?.interval
            }
          }))
        };
      } catch (subError) {
        console.error('Error fetching subscription details:', subError);
        // Continue without subscription details
      }
    }

    // Prepare response based on session status
    const response = {
      success: true,
      session: {
        id: session.id,
        status: session.status,
        payment_status: session.payment_status,
        subscription: subscriptionDetails,
        customer: session.customer?.id,
        amount_total: session.amount_total,
        currency: session.currency,
        payment_intent: session.payment_intent?.id,
        setup_intent: session.setup_intent?.id
      }
    };

    // Add specific status messages
    switch (session.payment_status) {
      case 'paid':
        response.message = 'Payment completed successfully';
        break;
      case 'unpaid':
        response.message = 'Payment is pending or failed';
        break;
      case 'no_payment_required':
        response.message = 'No payment was required';
        break;
      default:
        response.message = `Payment status: ${session.payment_status}`;
    }

    // Check if subscription was created and is active
    if (subscriptionDetails) {
      const isActive = ['active', 'trialing'].includes(subscriptionDetails.status);
      response.subscription_active = isActive;

      if (isActive) {
        try {
          // Update local subscription status if needed
          await Subscription.updateData(
            subscriptionDetails.id,
            subscriptionDetails.status,
            subscriptionDetails.current_period_end,
            JSON.stringify(session.subscription)
          );
        } catch (dbError) {
          console.error('Error updating subscription status in database:', dbError);
          // Continue without failing the request
        }
      }
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Verify session error:', error);
    return handleError(res, error, 'Failed to verify session');
  }
};
