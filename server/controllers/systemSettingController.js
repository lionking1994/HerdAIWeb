const pool = require("../config/database");
const { handleError } = require("../utils/errorHandler");
const { verifyApiToken, processAI } = require("../utils/llmservice");
const { v4: uuidv4 } = require("uuid");
const stripeConfig = require('../config/stripe');
const { test_prompt } = require("../utils/llmservice");

const THRESHOLD_KEY = "threshold";

// Get all system settings
exports.getSettings = async (req, res) => {
  try {
    // Get system settings
    const settingsResult = await pool.query("SELECT * FROM system_settings");

    // Get API configurations with their models
    const apiConfigsResult = await pool.query(`
      SELECT 
        ac.*,
        array_agg(
          CASE 
            WHEN acm.id IS NOT NULL THEN
              json_build_object(
                'id', acm.id,
                'name', acm.name,
                'model', acm.model
              )
          END
        ) FILTER (WHERE acm.id IS NOT NULL) as models
      FROM api_configurations ac
      LEFT JOIN api_config_models acm ON ac.id = acm.config_id
      GROUP BY ac.id
    `);

    res.json({
      success: true,
      settings: settingsResult.rows,
      apiConfigs: apiConfigsResult.rows,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch system settings");
  }
};

// Get threshold setting
exports.getThreshold = async (req, res) => {
  try {
    const query = `
            SELECT setting_value
            FROM system_settings
            WHERE setting_key = $1
        `;

    const result = await pool.query(query, [THRESHOLD_KEY]);

    // If no threshold exists, return default value
    if (result.rows.length === 0) {
      return res.json({
        success: true,
        threshold: {
          value: 0,
          description: "Default threshold value",
        },
      });
    }

    res.json({
      success: true,
      threshold: {
        value: parseInt(result.rows[0].setting_value),
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch threshold setting");
  }
};

exports.updateSettings = async (req, res) => {
  let { threshold } = req.body;

  if (threshold === undefined || threshold < 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid threshold value. Must be a non-negative number.",
    });
  }

  const settingKeyThreshold = "threshold"; // Define your key

  const query = `
    INSERT INTO system_settings (setting_key, setting_value, description)
    VALUES ($1, $2, $3)
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      description = EXCLUDED.description,
      updated_at = CURRENT_TIMESTAMP
  `;

  const values = [
    settingKeyThreshold,
    threshold.toString(),
    "System threshold value",
  ];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(query, values);
    await client.query("COMMIT");
    return res.json({
      success: true,
      message: "Settings updated successfully.",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating settings:", err);
    return handleError(res, err, "Failed to update settings");
  } finally {
    client.release();
  }
};

// Update threshold setting
exports.updateThreshold = async (req, res) => {
  const { threshold } = req.body;
  // Validate input
  if (threshold === undefined || threshold < 0) {
    return res.status(400).json({
      success: false,
      error: "Invalid threshold value. Must be a non-negative number.",
    });
  }

  try {
    const query = `
            INSERT INTO system_settings (
                setting_key, 
                setting_value, 
                description
            ) 
            VALUES ($1, $2, $3)
            ON CONFLICT (setting_key) 
            DO UPDATE SET 
                setting_value = $2,
                description = COALESCE($3, system_settings.description),
                updated_at = CURRENT_TIMESTAMP
            RETURNING setting_value, description
        `;

    const result = await pool.query(query, [
      THRESHOLD_KEY,
      threshold.toString(),
      "System threshold value",
    ]);

    res.json({
      success: true,
      threshold: {
        value: parseInt(result.rows[0].setting_value),
        description: result.rows[0].description,
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to update threshold setting");
  }
};

// Delete threshold setting (reset to default)
exports.deleteThreshold = async (req, res) => {
  try {
    const query = `
            DELETE FROM system_settings
            WHERE setting_key = $1
            RETURNING *
        `;

    await pool.query(query, [THRESHOLD_KEY]);

    res.json({
      success: true,
      message: "Threshold setting reset to default",
      threshold: {
        value: 0,
        description: "Default threshold value",
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete threshold setting");
  }
};

// Initialize threshold setting
exports.initializeThreshold = async (req, res) => {
  try {
    const query = `
            INSERT INTO system_settings (
                setting_key, 
                setting_value, 
                description
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (setting_key) DO NOTHING
            RETURNING setting_value, description
        `;

    await pool.query(query, [THRESHOLD_KEY, "0", "System threshold value"]);

    res.json({
      success: true,
      message: "Threshold setting initialized",
    });
  } catch (error) {
    return handleError(res, error, "Failed to initialize threshold setting");
  }
};

// Get all API configurations
exports.getApiConfigs = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM api_configurations");
    res.json({
      success: true,
      apiConfigs: result.rows,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch API configurations");
  }
};

// Create a new API configuration
exports.createApiConfig = async (req, res) => {
  const { name, provider, apiKey } = req.body;

  if (!name || !provider || !apiKey) {
    return res.status(400).json({
      success: false,
      error: "Name, provider, and API key are required.",
    });
  }

  // Verify API key based on provider
  if (provider === "perplexity") {
    const verificationResult = await verifyApiToken(apiKey);
    if (verificationResult.status === false) {
      return res.status(400).json({
        success: false,
        error: verificationResult.message,
      });
    }
  }

  // For Claude, add verification logic here if needed

  try {
    const id = uuidv4(); // Generate a unique ID

    const query = `
      INSERT INTO api_configurations (id, name, provider, api_key)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await pool.query(query, [id, name, provider, apiKey]);

    res.json({
      success: true,
      message: "API configuration created successfully",
      apiConfig: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to create API configuration");
  }
};

// Update an existing API configuration
exports.updateApiConfig = async (req, res) => {
  const { id } = req.params;
  const { name, provider, apiKey } = req.body;

  if (!name || !provider || !apiKey) {
    return res.status(400).json({
      success: false,
      error: "Name, provider, and API key are required.",
    });
  }

  // Verify API key based on provider
  if (provider === "perplexity") {
    const verificationResult = await verifyApiToken(apiKey);
    if (verificationResult.status === false) {
      return res.status(400).json({
        success: false,
        error: verificationResult.message,
      });
    }
  }

  // For Claude, add verification logic here if needed

  try {
    const query = `
      UPDATE api_configurations
      SET name = $1, provider = $2, api_key = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;

    const result = await pool.query(query, [name, provider, apiKey, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "API configuration not found",
      });
    }

    res.json({
      success: true,
      message: "API configuration updated successfully",
      apiConfig: result.rows[0],
    });
  } catch (error) {
    return handleError(res, error, "Failed to update API configuration");
  }
};

// Delete an API configuration
exports.deleteApiConfig = async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      DELETE FROM api_configurations
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "API configuration not found",
      });
    }

    res.json({
      success: true,
      message: "API configuration deleted successfully",
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete API configuration");
  }
};

// Add these new controller methods

exports.addModel = async (req, res) => {
  try {
    const { configId } = req.params;
    const { name, model } = req.body;
    console.log("configId", configId, "name", name, "model", model);
    // Get the API configuration details first
    const configQuery = await pool.query(
      "SELECT provider FROM api_configurations WHERE id = $1",
      [configId]
    );

    if (configQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "API configuration not found",
      });
    }

    const provider = configQuery.rows[0].provider;

    // Test the model using llmservice
    const testResult = await test_prompt(
      "You are a helpful AI assistant.", // system prompt
      "Hello, this is a test message.", // user prompt
      100, // max tokens
      provider, // API provider from database
      model // model ID from request body
    );

    if (!testResult.status) {
      return res.status(400).json({
        success: false,
        error: `Model test failed: ${testResult.error}`,
      });
    }

    if (!name || !model) {
      return res.status(400).json({
        success: false,
        error: "Name and model are required",
      });
    }

    const result = await pool.query(
      `INSERT INTO api_config_models (config_id, name, model)
           VALUES ($1, $2, $3)
           RETURNING id`,
      [configId, name, model]
    );

    res.json({
      success: true,
      modelId: result.rows[0].id,
    });
  } catch (error) {
    console.error("Error adding model:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add model",
    });
  }
};

exports.updateModel = async (req, res) => {
  try {
    const { configId, modelId } = req.params;
    const { name, model } = req.body;

    if (!name || !model) {
      return res.status(400).json({
        success: false,
        error: "Name and model are required",
      });
    }

    const result = await pool.query(
      `UPDATE api_config_models 
           SET name = $1, model = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3 AND config_id = $4
           RETURNING *`,
      [name, model, modelId, configId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Model not found",
      });
    }

    res.json({
      success: true,
      model: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating model:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update model",
    });
  }
};

exports.getApiConfig = async (req, res) => {
  try {
    const { configId } = req.params;

    const configResult = await pool.query(
      `SELECT ac.*, array_agg(json_build_object(
              'id', acm.id,
              'name', acm.name,
              'model', acm.model
          )) as models
           FROM api_configurations ac
           LEFT JOIN api_config_models acm ON ac.id = acm.config_id
           WHERE ac.id = $1
           GROUP BY ac.id`,
      [configId]
    );

    if (configResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "API config not found",
      });
    }

    res.json({
      success: true,
      apiConfig: configResult.rows[0],
    });
  } catch (error) {
    console.error("Error fetching API config:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch API config",
    });
  }
};

exports.deleteModel = async (req, res) => {
  try {
    const { configId, modelId } = req.params;

    await pool.query(
      "DELETE FROM api_config_models WHERE id = $1 AND config_id = $2",
      [modelId, configId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting model:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete model",
    });
  }
};

// Add these functions to handle Stripe configuration

/**
 * Get Stripe configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getStripeConfig = async (req, res) => {
  try {
    console.log('getStripeConfig called💢💢💢💢💢💢💢');
    // Get Stripe configuration from database
    const stripeConfigQuery = await pool.query(
      "SELECT * FROM system_settings WHERE setting_key = 'stripe_config'"
    );
    console.log('stripeConfigQuery.rows', stripeConfigQuery.rows);

    if (stripeConfigQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Stripe configuration not found"
      });
    }

    const stripeConfig = JSON.parse(stripeConfigQuery.rows[0].setting_value);
    console.log('stripeConfig', stripeConfig);


    return res.status(200).json({
      success: true,
      stripeConfig
    });
  } catch (error) {
    console.error("Error getting Stripe configuration:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get Stripe configuration"
    });
  }
};

/**
 * Update Stripe configuration
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateStripeConfig = async (req, res) => {
  try {
    const {
      maxMeetingCount,
      productionPublishableKey,
      productionSecretKey,
      productionWebhookSecret,
      sandboxPublishableKey,
      sandboxSecretKey,
      sandboxWebhookSecret,
      environment
    } = req.body;

    // Validate required fields
    if (!maxMeetingCount || !productionPublishableKey || !productionSecretKey ||
      !productionWebhookSecret || !sandboxPublishableKey || !sandboxSecretKey ||
      !sandboxWebhookSecret || !environment) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    // Create Stripe configuration object
    const stripeConfig = {
      maxMeetingCount,
      productionPublishableKey,
      productionSecretKey,
      productionWebhookSecret,
      sandboxPublishableKey,
      sandboxSecretKey,
      sandboxWebhookSecret,
      environment
    };

    // Check if Stripe configuration exists
    const existingConfigQuery = await pool.query(
      "SELECT * FROM system_settings WHERE setting_key = 'stripe_config'"
    );

    if (existingConfigQuery.rows.length > 0) {
      // Update existing configuration
      await pool.query(
        "UPDATE system_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = 'stripe_config'",
        [JSON.stringify(stripeConfig)]
      );
    } else {
      // Create new configuration
      await pool.query(
        "INSERT INTO system_settings (setting_key, setting_value,  updated_at) VALUES ('stripe_config', $1, NOW())",
        [JSON.stringify(stripeConfig)]
      );
    }

    // Update environment variables
    if (environment === "production") {
      process.env.STRIPE_PUBLISHABLE_KEY = productionPublishableKey;
      process.env.STRIPE_SECRET_KEY = productionSecretKey;
      process.env.STRIPE_WEBHOOK_SECRET = productionWebhookSecret;
    } else {
      process.env.STRIPE_PUBLISHABLE_KEY = sandboxPublishableKey;
      process.env.STRIPE_SECRET_KEY = sandboxSecretKey;
      process.env.STRIPE_WEBHOOK_SECRET = sandboxWebhookSecret;
    }

    // Update subscription threshold
    await pool.query(
      "UPDATE system_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = 'subscription_threshold'",
      [maxMeetingCount.toString()]
    );

    return res.status(200).json({
      success: true,
      message: "Stripe configuration updated successfully"
    });
  } catch (error) {
    console.error("Error updating Stripe configuration:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Stripe configuration"
    });
  }
};


exports.stripeEnvironment = async (req, res) => {
  try {
    const { environment } = req.body;
    if (!environment) {
      return res.status(400).json({
        success: false,
        message: "Environment is required"
      });
    }
    if (environment !== "production" && environment !== "sandbox") {
      return res.status(400).json({
        success: false,
        message: "Invalid environment"
      });
    }

    const stripeResult = await pool.query(
      "SELECT setting_value FROM system_settings WHERE setting_key = 'stripe_config'"
    );

    const stripeData = JSON.parse(stripeResult.rows[0].setting_value);
    stripeData.environment = environment;

    await pool.query(
      "UPDATE system_settings SET setting_value = $1, updated_at = NOW() WHERE setting_key = 'stripe_config'",
      [stripeData]
    );


    if (environment === "production") {
      process.env.STRIPE_ENVIRONMENT = 'production';
      process.env.STRIPE_PUBLISHABLE_KEY = stripeData.productionPublishableKey;
      process.env.STRIPE_SECRET_KEY = stripeData.productionSecretKey;
      process.env.STRIPE_WEBHOOK_SECRET = stripeData.productionWebhookSecret;
    } else {
      process.env.STRIPE_ENVIRONMENT = 'sandbox';
      process.env.STRIPE_PUBLISHABLE_KEY = stripeData.sandboxPublishableKey;
      process.env.STRIPE_SECRET_KEY = stripeData.sandboxSecretKey;
      process.env.STRIPE_WEBHOOK_SECRET = stripeData.sandboxWebhookSecret;
    }

    return res.status(200).json({
      success: true,
      message: "Stripe environment updated successfully"
    });
  } catch (error) {
    console.error("Error updating Stripe environment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Stripe environment"
    });
  }
};

exports.stripeProducts = async (req, res) => {
  try {
    //Get stripe products and used prices by expanding default prices
    const stripe = stripeConfig.getStripe();

    const products = await stripe.products.list({
      expand: ['data.default_price']
    });
    return res.status(200).json({
      success: true,
      products: products.data
    });

  } catch (error) {
    console.error("Error fetching Stripe products:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Stripe products"
    });
  }
};


/*
  const productData = {
    name: newProduct.name,
    description: newProduct.description,
    // Price data for creating the associated price
    price_data: {
      unit_amount: Math.round(newProduct.price * 100), // Convert to cents for Stripe
      currency: 'usd',
      recurring: {
        interval: newProduct.interval
      }
    },
    features: newProduct.features.filter(f => f.trim() !== "")
  };

  const response = await axios.post(
    `${import.meta.env.VITE_API_BASE_URL}/system-settings/add-product`,
    productData,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

*/

exports.addProduct = async (req, res) => {
  try {

    const { name, description, price_data, features } = req.body;

    if (!name || !price_data) {
      return res.status(400).json({
        success: false,
        message: "Name and price are required"
      });
    }
    const stripe = stripeConfig.getStripe();
    const product = await stripe.products.create({
      name,
      description,
      features: features || []
    });

    const priceObj = await stripe.prices.create({
      product: product.id,
      ...price_data
    });

    await stripe.products.update(product.id, {
      default_price: priceObj.id
    });

    return res.status(200).json({
      success: true,
      message: "Product created successfully",
      product
    });
  } catch (error) {
    console.error("Error creating Stripe product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Stripe product",
      error: error.message
    });
  }

  //   const { name, description, price, interval, features } = req.body;

  //   console.log(name, description, price, interval, features)
  //   if (!name || !price) {
  //     return res.status(400).json({
  //       success: false,
  //       message: "Name and price are required"
  //     });
  //   }
  //   const stripe = stripeConfig.getStripe();

  //   // Create the product first
  //   const product = await stripe.products.create({
  //     name,
  //     description,
  //     features: features || []
  //   });

  //   // Create the price
  //   const priceObj = await stripe.prices.create({
  //     product: product.id,
  //     unit_amount: price, // Ensure this is in cents (e.g., $29.99 = 2999)
  //     currency: "usd",
  //     recurring: {
  //       interval: interval || "month"
  //     }
  //   });

  //   // Update the product to set this price as the default price
  //   await stripe.products.update(product.id, {
  //     default_price: priceObj.id
  //   });

  //   // Fetch the updated product with the default price
  //   const updatedProduct = await stripe.products.retrieve(product.id, {
  //     expand: ['default_price']
  //   });

  //   return res.status(200).json({
  //     success: true,
  //     message: "Product created successfully",
  //     product: updatedProduct
  //   });
  // } catch (error) {
  //   console.error("Error creating Stripe product:", error);
  //   return res.status(500).json({
  //     success: false,
  //     message: "Failed to create Stripe product",
  //     error: error.message
  //   });
  // }


};

exports.archiveProduct = async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    const stripe = stripeConfig.getStripe();
    console.log('Product id:', product_id);

    // 1. First deactivate all prices for this product
    const prices = await stripe.prices.list({
      product: product_id,
      active: true, // Only get active prices
      limit: 100
    });
    for (const price of prices.data) {
      await stripe.prices.update(price.id, { active: false });
    }
    // 2. Then deactivate the product itself
    await stripe.products.update(product_id, { active: false });

    return res.status(200).json({
      success: true,
      message: "Product archived successfully"
    });
  }
  catch (error) {
    console.error("Error archiving Stripe product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to archive Stripe product",
      error: error.message
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, active, features, price_data } = req.body;

    console.log('Update product request:', { id, name, description, active, features, price_data });

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required"
      });
    }

    const stripe = stripeConfig.getStripe();

    // Retrieve the product with its default price
    const product = await stripe.products.retrieve(id, {
      expand: ['default_price']
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    // Update the product details
    await stripe.products.update(id, {
      name: name || product.name,
      description: description || product.description,
      active: active !== undefined ? active : product.active,
      features: features || product.features
    });

    // Handle price update if price_data is provided
    if (price_data) {
      // Stripe doesn't allow updating existing prices, so we need to:
      // 1. Create a new price
      // 2. Set it as the default price for the product
      // 3. Optionally deactivate the old price

      // Create new price
      const newPrice = await stripe.prices.create({
        product: id,
        unit_amount: price_data.unit_amount,
        currency: price_data.currency || 'usd',
        recurring: price_data.recurring,
        tax_behavior: 'exclusive'
      });

      console.log('Created new price:', newPrice.id);

      // Update product to use the new price as default
      await stripe.products.update(id, {
        default_price: newPrice.id
      });

      // Optionally deactivate the old price if it exists
      if (product.default_price && product.default_price.id !== newPrice.id) {
        await stripe.prices.update(product.default_price.id, {
          active: false
        });
        console.log('Deactivated old price:', product.default_price.id);
      }
    }

    // Retrieve the updated product with the new default price
    const updatedProduct = await stripe.products.retrieve(id, {
      expand: ['default_price']
    });

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product: updatedProduct
    });
  } catch (error) {
    console.error("Error updating Stripe product:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Stripe product",
      error: error.message
    });
  }
}

exports.getProductivityQuoteForaday = async (req, res) => {
  try {
    const userId = req.user.id;
    const todaydate = req.query.todaydate; 
    const result = await pool.query(`SELECT * FROM quotes WHERE user_id = $1`, [userId]);
    if (result.rows.length > 0) {
      const savedDate = new Date(result.rows[0].expire_date);
      const savedDateStr = savedDate.getFullYear() + '-' +
        String(savedDate.getMonth() + 1).padStart(2, '0') + '-' +
        String(savedDate.getDate()).padStart(2, '0');
      if (savedDateStr === todaydate) {
        return res.json({
          success: true,
          quote: result.rows[0].quote
        });
      }
    }

    // Get current date information for variety
    const currentDate = new Date();
    const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
    const month = currentDate.toLocaleDateString('en-US', { month: 'long' });
    const dayOfMonth = currentDate.getDate();
    const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
    const isMonday = currentDate.getDay() === 1;
    const isFriday = currentDate.getDay() === 5;
    const isEndOfMonth = currentDate.getDate() >= 25;
    const isBeginningOfMonth = currentDate.getDate() <= 7;
    const isQuarterEnd = [3, 6, 9, 12].includes(currentDate.getMonth() + 1) && currentDate.getDate() >= 20;
    
    // Create dynamic context based on day and time
    let dayContext = '';
    let specialContext = '';
    
    if (isMonday) {
      dayContext = 'Monday motivation and fresh start energy';
      specialContext = 'new week, new opportunities';
    } else if (isFriday) {
      dayContext = 'Friday focus and week completion';
      specialContext = 'weekend preparation and achievement celebration';
    } else if (isWeekend) {
      dayContext = 'weekend reflection and preparation';
      specialContext = 'recharge and strategic planning';
    } else {
      dayContext = 'midweek productivity and momentum';
      specialContext = 'building on progress and maintaining focus';
    }
    
    // Add seasonal and monthly context
    if (isEndOfMonth) {
      specialContext += ', month-end reflection and goal assessment';
    } else if (isBeginningOfMonth) {
      specialContext += ', fresh monthly goals and renewed energy';
    }
    
    if (isQuarterEnd) {
      specialContext += ', quarterly achievement and strategic planning';
    }
    
    // Add random elements for additional variety
    const randomThemes = [
      'effective communication',
      'strategic thinking', 
      'team collaboration',
      'personal growth',
      'innovation mindset',
      'time optimization',
      'leadership development',
      'goal achievement',
      'work-life balance',
      'continuous improvement'
    ];
    
    const randomTheme = randomThemes[Math.floor(Math.random() * randomThemes.length)];
    const randomPerspective = Math.random() > 0.5 ? 'from a leadership perspective' : 'from a personal development perspective';

    const prompt = `
    Generate a unique, inspiring productivity quote for ${dayOfWeek}, ${month} ${dayOfMonth} that captures the essence of ${dayContext} and ${specialContext}.
    
    The quote should be:
    - Related to meetings, productivity, motivation, leadership, or professional development
    - Maximum 70 words
    - One complete, impactful sentence
    - Tailored to the current day context and special circumstances
    - Professional yet inspiring
    - Focus on the theme of "${randomTheme}" ${randomPerspective}
    - Include specific themes like: collaboration, focus, time management, innovation, growth, success, or resilience
    
    Consider these themes based on the day:
    ${isMonday ? '- Fresh starts, goal setting, and weekly planning' : ''}
    ${isFriday ? '- Achievement, reflection, and preparation for next week' : ''}
    ${isWeekend ? '- Balance, reflection, and strategic thinking' : ''}
    ${!isMonday && !isFriday && !isWeekend ? '- Momentum, progress, and maintaining focus' : ''}
    ${isEndOfMonth ? '- Month-end reflection, goal assessment, and preparation for next month' : ''}
    ${isBeginningOfMonth ? '- Fresh monthly goals, renewed energy, and strategic planning' : ''}
    ${isQuarterEnd ? '- Quarterly achievement, strategic planning, and long-term vision' : ''}
    
    Make the quote feel specifically relevant to today's unique combination of factors and incorporate the "${randomTheme}" theme naturally.
    
    The quote should be original and not a commonly known quote. Make it feel fresh and relevant to today's specific context.
    Return only the quote, no additional text.
    `;

    const sysprompt = `You are an expert productivity coach and motivational speaker who creates unique, daily-relevant quotes. 
    You understand the psychology of productivity and how different days of the week, months, and seasons affect people's motivation and energy levels.
    
    Key principles for creating unique daily quotes:
    1. Never repeat the same quote structure or theme on consecutive days
    2. Incorporate the specific day context and special circumstances into the quote
    3. Use varied sentence structures and writing styles
    4. Focus on different aspects of productivity each day (collaboration, focus, innovation, etc.)
    5. Make each quote feel specifically crafted for the current moment
    6. Avoid generic motivational language - be specific and actionable
    7. Consider the user's likely mental state on this particular day
    
    Always create original, inspiring content that feels fresh and relevant to the specific day context.`;
    console.log(`🤖 Generating productivity quote for ${dayOfWeek}, ${month} ${dayOfMonth}`);
    console.log(`📅 Day context: ${dayContext}`);
    console.log(`🎯 Special context: ${specialContext}`);
    console.log(`🎲 Random theme: ${randomTheme} (${randomPerspective})`);
    
    const aiResponse = await processAI(sysprompt, prompt, 2048);

    console.log(`🤖 AI response: ${aiResponse}`);


    // Update or insert the quote
    if (result.rows.length > 0) {
      await pool.query(`UPDATE quotes SET quote = $1, expire_date = $2 WHERE user_id = $3`, [aiResponse, todaydate, userId]);
    } else {
      await pool.query(`INSERT INTO quotes (user_id, quote, expire_date) VALUES ($1, $2, $3)`, [userId, aiResponse, todaydate]);
    }

    console.log(`✅ Generated quote: "${aiResponse}"`);
    
    res.json({
      success: true,
      quote: aiResponse
    });
  } catch (error) {
    console.error("Error in getProductivityQuoteForaday:", error);
    return handleError(res, error, "Failed to fetch productivity quote");
  }
}

// Enhanced function to extract quote from various text formats
function extractQuoteFromText(response) {
  if (!response) return "Productivity begins with a single focused action.";

  let cleaned = response.trim();
  console.log(`🔧 Extracting quote from text: "${cleaned}"`);

  // Remove markdown formatting
  cleaned = cleaned.replace(/```.*?```/gs, ''); // Remove code blocks
  cleaned = cleaned.replace(/`.*?`/g, ''); // Remove inline code
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold
  cleaned = cleaned.replace(/\*(.*?)\*/g, '$1'); // Remove italic

  // Remove common unwanted prefixes and explanations
  const unwantedPrefixes = [
    /^here is a.*?quote.*?:?\s*/i,
    /^here's a.*?quote.*?:?\s*/i,
    /^here is your.*?quote.*?:?\s*/i,
    /^here's your.*?quote.*?:?\s*/i,
    /^here is a \d+ word.*?:?\s*/i,
    /^here's a \d+ word.*?:?\s*/i,
    /^productivity quote.*?:?\s*/i,
    /^quote.*?:?\s*/i,
    /^here is.*?:?\s*/i,
    /^here's.*?:?\s*/i,
    /^here you go.*?:?\s*/i,
    /^here it is.*?:?\s*/i,
    /^your quote.*?:?\s*/i,
    /^the quote.*?:?\s*/i,
    /^a quote.*?:?\s*/i,
    /^an inspiring quote.*?:?\s*/i,
    /^today's quote.*?:?\s*/i,
    /^daily quote.*?:?\s*/i,
    /^this is not json but here is a quote.*?:?\s*/i,
    /^a motivational quote for you.*?:?\s*/i,
    /^your productivity quote.*?:?\s*/i
  ];

  unwantedPrefixes.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '');
  });

  // Remove JSON-like structures that might be in the text
  cleaned = cleaned.replace(/\{[^}]*"quote"[^}]*\}/g, '');
  cleaned = cleaned.replace(/\{[^}]*"text"[^}]*\}/g, '');
  cleaned = cleaned.replace(/\{[^}]*"message"[^}]*\}/g, '');

  // Remove quotes if they wrap the entire text
  cleaned = cleaned.replace(/^["'](.*)["']$/, '$1');

  // Look for quoted text within the response
  const quoteMatch = cleaned.match(/["']([^"']{10,})["']/);
  if (quoteMatch) {
    cleaned = quoteMatch[1];
  }

  // Split by common sentence endings and take the first meaningful sentence
  const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length > 0) {
    cleaned = sentences[0].trim();
    // Add period if it doesn't end with punctuation
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += '.';
    }
  }

  // Final cleanup
  cleaned = cleaned.trim();
  
  // If we still don't have a meaningful quote, provide a fallback
  if (cleaned.length < 10 || cleaned.length > 200) {
    console.warn("Extracted quote seems invalid, using fallback");
    return "Success comes from consistent daily actions that align with your goals.";
  }

  console.log(`✅ Extracted quote: "${cleaned}"`);
  return cleaned;
}

// Function to validate and clean the final quote
function validateAndCleanQuote(quote) {
  if (!quote || typeof quote !== 'string') {
    console.warn("Invalid quote received, using fallback");
    return "Productivity is not about being busy, it's about being effective.";
  }

  let validated = quote.trim();

  // Remove any remaining unwanted characters or formatting
  validated = validated.replace(/[\r\n\t]/g, ' '); // Remove newlines and tabs
  validated = validated.replace(/\s+/g, ' '); // Normalize whitespace

  // Ensure it's a single sentence
  const sentences = validated.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 1) {
    validated = sentences[0].trim();
    if (!/[.!?]$/.test(validated)) {
      validated += '.';
    }
  }


  // Ensure it ends with proper punctuation
  if (!/[.!?]$/.test(validated)) {
    validated += '.';
  }

  console.log(`✅ Validated quote: "${validated}"`);
  return validated;
}


/**
 * Get Agent configuration with environment variable fallback
 * @param {Object} req - Express request object  
 * @param {Object} res - Express response object
 */
exports.getAgentConfig = async (req, res) => {
  try {
    console.log('getAgentConfig called');

    // Get Agent configuration from database
    const agentConfigQuery = await pool.query(
      "SELECT * FROM system_settings WHERE setting_key = 'agent_config'"
    );

    let agentConfig;

    if (agentConfigQuery.rows.length === 0) {
      // Fallback to environment variables if not in database
      agentConfig = {
        recallApiKey: process.env.RECALL_API_KEY || "",
        elevenlabsKey: process.env.ELEVENLABS_API_KEY || "",
        pineconeApiKey: process.env.PINECONE_API_KEY || "",
        pineconeIndexName: process.env.PINECONE_INDEX_NAME || "",
        agentId: process.env.NEXT_PUBLIC_AGENT_ID || ""
      };

      console.log('No database config found, using environment variables');
    } else {
      agentConfig = JSON.parse(agentConfigQuery.rows[0].setting_value);

      // Fill in missing values from environment variables
      agentConfig.recallApiKey = agentConfig.recallApiKey || process.env.RECALL_API_KEY || "";
      agentConfig.elevenlabsKey = agentConfig.elevenlabsKey || process.env.ELEVENLABS_API_KEY || "";
      agentConfig.pineconeApiKey = agentConfig.pineconeApiKey || process.env.PINECONE_API_KEY || "";
      agentConfig.pineconeIndexName = agentConfig.pineconeIndexName || process.env.PINECONE_INDEX_NAME || "";
      agentConfig.agentId = agentConfig.agentId || process.env.NEXT_PUBLIC_AGENT_ID || "";
    }

    return res.status(200).json({
      success: true,
      agentConfig
    });
  } catch (error) {
    console.error("Error getting Agent configuration:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get Agent configuration"
    });
  }
};

/**
 * Update Agent configuration in database and environment variables
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateAgentConfig = async (req, res) => {
  try {
    const {
      recallApiKey,
      elevenlabsKey,
      pineconeApiKey,
      agentId,
      pineconeIndexName
    } = req.body;


    // Create Agent configuration object
    const agentConfig = {
      recallApiKey,
      elevenlabsKey,
      pineconeApiKey,
      pineconeIndexName,
      agentId
    };

    // Update environment variables
    process.env.RECALL_API_KEY = recallApiKey;
    process.env.ELEVENLABS_API_KEY = elevenlabsKey;
    process.env.PINECONE_API_KEY = pineconeApiKey;
    process.env.PINECONE_INDEX_NAME = pineconeIndexName;
    process.env.NEXT_PUBLIC_AGENT_ID = agentId;

    console.log('Updated environment variables');

    // Check if Agent configuration exists in database
    const existingConfigQuery = await pool.query(
      "SELECT * FROM system_settings WHERE setting_key = 'agent_config'"
    );

    if (existingConfigQuery.rows.length === 0) {
      // Insert new configuration
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value, description)
         VALUES ($1, $2, $3)`,
        ['agent_config', JSON.stringify(agentConfig), 'Agent API configuration settings']
      );
      console.log('Inserted new agent config to database');
    } else {
      // Update existing configuration
      await pool.query(
        `UPDATE system_settings 
         SET setting_value = $1, updated_at = CURRENT_TIMESTAMP
         WHERE setting_key = 'agent_config'`,
        [JSON.stringify(agentConfig)]
      );
      console.log('Updated existing agent config in database');
    }

    return res.status(200).json({
      success: true,
      message: "Agent configuration updated successfully",
      agentConfig
    });
  } catch (error) {
    console.error("Error updating Agent configuration:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update Agent configuration"
    });
  }
};

/**
 * Get individual Agent API keys and configuration values with environment fallback
 * @param {Object} req - Express request object  
 * @param {Object} res - Express response object
 */
exports.getAgentApiKeys = async (req, res) => {
  try {
    console.log('getAgentApiKeys called');

    // Get Agent configuration from database
    const agentConfigQuery = await pool.query(
      "SELECT * FROM system_settings WHERE setting_key = 'agent_config'"
    );

    let recallApiKey, elevenlabsKey, pineconeApiKey, pineconeIndexName;

    if (agentConfigQuery.rows.length === 0) {
      // Fallback to environment variables if not in database
      recallApiKey = process.env.RECALL_API_KEY || "";
      elevenlabsKey = process.env.ELEVENLABS_API_KEY || "";
      pineconeApiKey = process.env.PINECONE_API_KEY || "";
      pineconeIndexName = process.env.PINECONE_INDEX_NAME || "";

      console.log('No database config found, using environment variables');
    } else {
      const agentConfig = JSON.parse(agentConfigQuery.rows[0].setting_value);

      // Use database values first, fallback to environment variables
      recallApiKey = agentConfig.recallApiKey || process.env.RECALL_API_KEY || "";
      elevenlabsKey = agentConfig.elevenlabsKey || process.env.ELEVENLABS_API_KEY || "";
      pineconeApiKey = agentConfig.pineconeApiKey || process.env.PINECONE_API_KEY || "";
      pineconeIndexName = agentConfig.pineconeIndexName || process.env.PINECONE_INDEX_NAME || "";
    }

    return res.status(200).json({
      success: true,
      recallApiKey,
      elevenlabsKey,
      pineconeApiKey,
      pineconeIndexName,
    });
  } catch (error) {
    console.error("Error getting Agent API keys:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get Agent API keys"
    });
  }
};

/**
 * Get specific Agent API key by type with environment fallback
 * @param {Object} req - Express request object  
 * @param {Object} res - Express response object
 */
exports.getAgentApiKeyByType = async (req, res) => {
  try {
    const { keyType } = req.params;

    console.log(`getAgentApiKeyByType called for: ${keyType}`);

    // Validate key type
    const validKeys = ['recall', 'elevenlabs', 'pinecone-api', 'pinecone-index'];
    if (!validKeys.includes(keyType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid key type. Valid types: recall, elevenlabs, pinecone-api, pinecone-index"
      });
    }

    // Get Agent configuration from database
    const agentConfigQuery = await pool.query(
      "SELECT * FROM system_settings WHERE setting_key = 'agent_config'"
    );

    let value = "";

    if (agentConfigQuery.rows.length === 0) {
      // Fallback to environment variables
      switch (keyType) {
        case 'recall':
          value = process.env.RECALL_API_KEY || "";
          break;
        case 'elevenlabs':
          value = process.env.ELEVENLABS_API_KEY || "";
          break;
        case 'pinecone-api':
          value = process.env.PINECONE_API_KEY || "";
          break;
        case 'pinecone-index':
          value = process.env.PINECONE_INDEX_NAME || "";
          break;
      }
      console.log(`No database config found, using environment variable for ${keyType}`);
    } else {
      const agentConfig = JSON.parse(agentConfigQuery.rows[0].setting_value);

      // Use database values first, fallback to environment variables
      switch (keyType) {
        case 'recall':
          value = agentConfig.recallApiKey || process.env.RECALL_API_KEY || "";
          break;
        case 'elevenlabs':
          value = agentConfig.elevenlabsKey || process.env.ELEVENLABS_API_KEY || "";
          break;
        case 'pinecone-api':
          value = agentConfig.pineconeApiKey || process.env.PINECONE_API_KEY || "";
          break;
        case 'pinecone-index':
          value = agentConfig.pineconeIndexName || process.env.PINECONE_INDEX_NAME || "";
          break;
      }
    }

    return res.status(200).json({
      success: true,
      keyType: keyType,
      value: value,
    });
  } catch (error) {
    console.error("Error getting Agent API key by type:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get Agent API key"
    });
  }
};