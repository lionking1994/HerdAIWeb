// Add these methods to your adminController.js

/**
 * Get user subscriptions for admin
 */
exports.getUserSubscriptions = async (req, res) => {
  const { subscriptionUserId } = req.body;

  try {
    // Check if admin
    if (!['padmin', 'dev'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Use the existing method from stripeController
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
                amount: product.price,
                currency: 'usd',
                interval: product.interval
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
    return res.status(500).json({
      success: false,
      message: 'Failed to get user subscriptions',
      error: error.message
    });
  }
};

/**
 * Cancel user subscription as admin
 */
exports.cancelUserSubscription = async (req, res) => {
  try {
    const { subscriptionId, userId } = req.body;

    // Check if admin
    if (!['padmin', 'dev'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access'
      });
    }

    // Verify subscription belongs to specified user
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription || subscription.user_id !== parseInt(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Invalid subscription or user mismatch'
      });
    }

    const stripe = stripeConfig.getStripe();

    // Cancel immediately
    await stripe.subscriptions.cancel(subscriptionId);

    // Update local subscription status
    await Subscription.updateStatus(subscriptionId, 'canceled');

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
};
