const Product = require('../models/Product');
const stripeConfig = require('../config/stripe');
const { handleError } = require('../utils/errorHandler');

/**
 * Get all products
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllProducts = async (req, res) => {
  try {
    const { enabled_only } = req.query;
    const enabledOnly = enabled_only !== 'false';
    
    const products = await Product.findAll(enabledOnly);
    
    return res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get products');
  }
};

/**
 * Get a product by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get product');
  }
};

/**
 * Create a new product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      interval,
      features
    } = req.body;
    
    // Validate required fields
    if (!name || !price) {
      return res.status(400).json({
        success: false,
        message: 'Name and price are required'
      });
    }
    
    // Create product in Stripe
    const stripe = stripeConfig.getStripe();
    const stripeProduct = await stripe.products.create({
      name,
      description
    });
    
    // Create price in Stripe
    const stripePrice = await stripe.prices.create({
      product: stripeProduct.id,
      unit_amount: Math.round(price * 100), // Convert to cents
      currency: 'usd',
      recurring: {
        interval: interval || 'month'
      }
    });
    
    // Create product in database
    const product = await Product.create({
      name,
      description,
      price,
      interval: interval || 'month',
      stripe_product_id: stripeProduct.id,
      stripe_price_id: stripePrice.id,
      is_enabled: true,
      features: features || []
    });
    
    return res.status(201).json({
      success: true,
      product
    });
  } catch (error) {
    return handleError(res, error, 'Failed to create product');
  }
};

/**
 * Update a product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      interval,
      features,
      is_enabled
    } = req.body;
    
    // Check if product exists
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Update product in Stripe
    const stripe = stripeConfig.getStripe();
    await stripe.products.update(existingProduct.stripe_product_id, {
      name: name || existingProduct.name,
      description: description || existingProduct.description,
      active: is_enabled !== undefined ? is_enabled : existingProduct.is_enabled
    });
    
    // If price changed, create a new price in Stripe
    let stripePriceId = existingProduct.stripe_price_id;
    if (price && price !== existingProduct.price) {
      const stripePrice = await stripe.prices.create({
        product: existingProduct.stripe_product_id,
        unit_amount: Math.round(price * 100), // Convert to cents
        currency: 'usd',
        recurring: {
          interval: interval || existingProduct.interval
        }
      });
      stripePriceId = stripePrice.id;
    }
    
    // Update product in database
    const product = await Product.update(id, {
      name,
      description,
      price,
      interval,
      stripe_price_id: stripePriceId,
      is_enabled,
      features
    });
    
    return res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    return handleError(res, error, 'Failed to update product');
  }
};

/**
 * Delete a product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if product exists
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Archive product in Stripe
    const stripe = stripeConfig.getStripe();
    await stripe.products.update(existingProduct.stripe_product_id, {
      active: false
    });
    
    // Delete product from database
    await Product.delete(id);
    
    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    return handleError(res, error, 'Failed to delete product');
  }
};

/**
 * Toggle product enabled status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.toggleProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_enabled } = req.body;
    
    if (is_enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: 'is_enabled field is required'
      });
    }
    console.log('toggleProductStatus, id:', id, ' , is_enabled:', is_enabled);
    
    // Check if product exists
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }
    
    // Update product in Stripe
    const stripe = stripeConfig.getStripe();
    await stripe.products.update(id, {
      active: is_enabled
    });
    
    // Update product in database
    const product = await Product.toggleEnabled(id, is_enabled);
    
    return res.status(200).json({
      success: true,
      product
    });
  } catch (error) {
    return handleError(res, error, 'Failed to toggle product status');
  }
};
