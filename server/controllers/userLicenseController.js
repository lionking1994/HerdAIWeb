const UserLicense = require('../models/UserLicense');
const Product = require('../models/Product');
const { handleError } = require('../utils/errorHandler');
const nodemailer = require('nodemailer');
const pool = require('../config/database');
const stripeConfig = require('../config/stripe');

/**
 * Get all user licenses with pagination, sorting, and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAllLicenses = async (req, res) => {
  try {
    const {
      page = 1,
      per_page = 10,
      filter = '',
      status,
      company_id,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.body;

    // Build WHERE clause for filtering
    let whereConditions = [];
    let queryParams = [];
    let paramIndex = 1;

    if (filter) {
      // Handle multiple date formats
      let searchFilter = filter;
      let dateSearchConditions = [];
      
      // DD/MM/YYYY format
      const ddMmYyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
      const ddMmYyyyMatch = filter.match(ddMmYyyyPattern);
      
      // DD-MM-YYYY format
      const ddMmYyyyDashPattern = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
      const ddMmYyyyDashMatch = filter.match(ddMmYyyyDashPattern);
      
      if (ddMmYyyyMatch) {
        const day = ddMmYyyyMatch[1].padStart(2, '0');
        const month = ddMmYyyyMatch[2].padStart(2, '0');
        const year = ddMmYyyyMatch[3];
        const yyyyMmDd = `${year}-${month}-${day}`;
        dateSearchConditions.push(`ul.created_at::date = '${yyyyMmDd}'::date`);
        dateSearchConditions.push(`ul.updated_at::date = '${yyyyMmDd}'::date`);
      } else if (ddMmYyyyDashMatch) {
        const day = ddMmYyyyDashMatch[1].padStart(2, '0');
        const month = ddMmYyyyDashMatch[2].padStart(2, '0');
        const year = ddMmYyyyDashMatch[3];
        const yyyyMmDd = `${year}-${month}-${day}`;
        dateSearchConditions.push(`ul.created_at::date = '${yyyyMmDd}'::date`);
        dateSearchConditions.push(`ul.updated_at::date = '${yyyyMmDd}'::date`);
      }
      
      // Build the main search condition
      let mainSearchCondition = `(
        c.name ILIKE $${paramIndex} OR 
        u.name ILIKE $${paramIndex} OR
        ul.payment_method ILIKE $${paramIndex} OR
        ul.status ILIKE $${paramIndex} OR
        ul.license_count::text ILIKE $${paramIndex} OR
        ul.total_price::text ILIKE $${paramIndex} OR
        ul.product_ids::text ILIKE $${paramIndex} OR
        ul.created_at::text ILIKE $${paramIndex} OR
        ul.updated_at::text ILIKE $${paramIndex} OR
        TO_CHAR(ul.created_at, 'DD/MM/YYYY') ILIKE $${paramIndex} OR
        TO_CHAR(ul.updated_at, 'DD/MM/YYYY') ILIKE $${paramIndex} OR
        TO_CHAR(ul.created_at, 'DD-MM-YYYY') ILIKE $${paramIndex} OR
        TO_CHAR(ul.updated_at, 'DD-MM-YYYY') ILIKE $${paramIndex}
      )`;
      
      // If we have date conditions, combine them
      if (dateSearchConditions.length > 0) {
        whereConditions.push(`(${mainSearchCondition} OR ${dateSearchConditions.join(' OR ')})`);
      } else {
        whereConditions.push(mainSearchCondition);
      }
      
      queryParams.push(`%${searchFilter}%`);
      paramIndex++;
    }

    if (status && status !== 'all') {
      whereConditions.push(`ul.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (company_id) {
      whereConditions.push(`ul.company_id = $${paramIndex}`);
      queryParams.push(company_id);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Validate sort_by to prevent SQL injection
    const allowedSortFields = ['created_at', 'updated_at', 'company_name', 'license_count', 'total_price', 'status', 'payment_method'];
    const validSortBy = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const validSortOrder = sort_order === 'asc' ? 'ASC' : 'DESC';

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM user_licenses ul
      LEFT JOIN company c ON ul.company_id = c.id
      LEFT JOIN users u ON ul.created_by = u.id
      ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Calculate pagination
    const offset = (page - 1) * per_page;
    const totalPages = Math.ceil(total / per_page);

    // Build main query with pagination and sorting
    const mainQuery = `
      SELECT ul.*, c.name as company_name, u.name as created_by_name
      FROM user_licenses ul
      LEFT JOIN company c ON ul.company_id = c.id
      LEFT JOIN users u ON ul.created_by = u.id
      ${whereClause}
      ORDER BY ${validSortBy === 'company_name' ? 'c.name' : `ul.${validSortBy}`} ${validSortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(per_page, offset);
    const { rows: licenses } = await pool.query(mainQuery, queryParams);

    return res.status(200).json({
      success: true,
      licenses,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total,
        total_pages: totalPages
      }
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get licenses');
  }
};

/**
 * Get licenses for a specific company
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCompanyLicenses = async (req, res) => {
  try {
    const { companyId } = req.params;
    const licenses = await UserLicense.findByCompanyId(companyId);
    
    return res.status(200).json({
      success: true,
      licenses
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get company licenses');
  }
};

/**
 * Get a license by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getLicenseById = async (req, res) => {
  try {
    const { id } = req.params;
    const license = await UserLicense.findById(id);
    
    if (!license) {
      return res.status(404).json({
        success: false,
        message: 'License not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      license
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get license');
  }
};

/**
 * Create a Stripe payment intent for license purchase
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createPaymentIntent = async (req, res) => {
  try {
    const {
      company_id,
      product_ids,
      license_count,
      total_price,
      payment_method,
      payment_details
    } = req.body;

    // Validate required fields
    if (!company_id || !product_ids || !license_count || !total_price) {
      return res.status(400).json({
        success: false,
        message: 'Company ID, product IDs, license count, and total price are required'
      });
    }

    // Create a temporary license record with pending status
    const license = await UserLicense.create({
      company_id,
      product_ids,
      license_count,
      total_price,
      payment_method: 'credit_card',
      payment_details: payment_details || {},
      status: 'pending',
      created_by: req.user.id
    });

    // Create Stripe payment intent
    const stripe = stripeConfig.getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(total_price * 100), // Convert to cents
      currency: 'usd',
      receipt_email: req.user.email, // Send receipt to user's email
      metadata: {
        license_id: license.id.toString(),
        company_id: company_id.toString(),
        user_id: req.user.id.toString(),
        user_email: req.user.email, // Store user email in metadata
        product_ids: JSON.stringify(product_ids),
        license_count: license_count.toString()
      },
      description: `License purchase for ${license_count} licenses`,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return res.status(200).json({
      success: true,
      client_secret: paymentIntent.client_secret,
      license_id: license.id,
      payment_intent_id: paymentIntent.id
    });
  } catch (error) {
    return handleError(res, error, 'Failed to create payment intent');
  }
};

/**
 * Create a Stripe checkout session for license purchase
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createCheckoutSession = async (req, res) => {
  try {
    const {
      company_id,
      product_ids,
      license_count,
      total_price,
      payment_details,
      existing_license_id // Add this to handle editing existing licenses
    } = req.body;

    // Validate required fields
    if (!company_id || !product_ids || !license_count || !total_price) {
      return res.status(400).json({
        success: false,
        message: 'Company ID, product IDs, license count, and total price are required'
      });
    }

    let license;

    if (existing_license_id) {
      // Update existing license for editing
      license = await UserLicense.update(existing_license_id, {
        company_id,
        product_ids,
        license_count,
        total_price,
        payment_method: 'credit_card',
        payment_details: payment_details || {},
        status: 'pending'
      });
    } else {
      // Create a new license record with pending status
      license = await UserLicense.create({
        company_id,
        product_ids,
        license_count,
        total_price,
        payment_method: 'credit_card',
        payment_details: payment_details || {},
        status: 'pending',
        created_by: req.user.id
      });
    }

    // Create Stripe checkout session with customer email pre-filled
    const stripe = stripeConfig.getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: req.user.email, // Pre-fill customer email
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `License Purchase - ${license_count} licenses`,
            description: `License purchase for company ID: ${company_id}`,
          },
          unit_amount: Math.round(total_price * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${stripeConfig.getClientUrl()}/admin/user-licenses?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${stripeConfig.getClientUrl()}/admin/user-licenses?canceled=true`,
      metadata: {
        license_id: license.id.toString(),
        company_id: company_id.toString(),
        user_id: req.user.id.toString(),
        user_email: req.user.email, // Store user email in metadata
        product_ids: JSON.stringify(product_ids),
        license_count: license_count.toString(),
        is_edit: existing_license_id ? 'true' : 'false' // Mark if this is an edit
      }
    });

    // Update license with payment link
    const paymentLink = session.url;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 24 hours from now
    
    await UserLicense.update(license.id, {
      payment_link: paymentLink,
      payment_link_expires_at: expiresAt
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      checkout_url: session.url,
      license_id: license.id
    });
  } catch (error) {
    return handleError(res, error, 'Failed to create checkout session');
  }
};

/**
 * Confirm payment and activate license
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.confirmPayment = async (req, res) => {
  try {
    const { payment_intent_id, license_id } = req.body;

    if (!payment_intent_id || !license_id) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID and license ID are required'
      });
    }

    // Verify payment intent with Stripe
    const stripe = stripeConfig.getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: 'Payment has not been completed'
      });
    }

    // Update license status to active
    const license = await UserLicense.update(license_id, {
      status: 'active',
      payment_details: {
        ...paymentIntent.metadata,
        stripe_payment_intent_id: payment_intent_id,
        payment_status: paymentIntent.status,
        customer_email: paymentIntent.receipt_email || paymentIntent.metadata.user_email,
        is_edited_license: paymentIntent.metadata.is_edit === 'true'
      }
    });

    // Update company license counts
    await updateCompanyLicenseCounts(license.company_id);

    return res.status(200).json({
      success: true,
      license,
      message: 'Payment confirmed and license activated'
    });
  } catch (error) {
    return handleError(res, error, 'Failed to confirm payment');
  }
};

/**
 * Handle Stripe webhook for license payments
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = stripeConfig.getWebhookSecret();
  const stripe = stripeConfig.getStripe();
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        
        // Handle license purchase completion
        if (session.metadata && session.metadata.license_id) {
          const licenseId = parseInt(session.metadata.license_id);
          
          // Check if this is a recurring subscription
          const isRecurring = session.metadata.is_recurring === 'true';
          
          // Update license status to active
          await UserLicense.update(licenseId, {
            status: 'active',
            payment_details: {
              ...session.metadata,
              stripe_session_id: session.id,
              payment_status: 'completed',
              customer_email: session.customer_details?.email || session.metadata.user_email,
              is_edited_license: session.metadata.is_edit === 'true'
            }
          });

          // If recurring, get subscription details and update next billing date
          if (isRecurring && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            await UserLicense.update(licenseId, {
              stripe_subscription_id: subscription.id,
              next_billing_date: new Date(subscription.current_period_end * 1000)
            });
          }

          // Update company license counts
          const updatedLicense = await UserLicense.findById(licenseId);
          if (updatedLicense) {
            await updateCompanyLicenseCounts(updatedLicense.company_id);
          }
        }
        break;
      }
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        
        // Handle recurring payment success
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          
          // Find license by subscription ID
          const { rows } = await pool.query(
            'SELECT * FROM user_licenses WHERE stripe_subscription_id = $1',
            [subscription.id]
          );
          
          if (rows.length > 0) {
            const license = rows[0];
            
            // Update next billing date
            await UserLicense.update(license.id, {
              next_billing_date: new Date(subscription.current_period_end * 1000),
              payment_details: {
                ...license.payment_details,
                last_payment_date: new Date().toISOString(),
                invoice_id: invoice.id
              }
            });
            
            // Update company license counts
            await updateCompanyLicenseCounts(license.company_id);
          }
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        
        // Handle subscription cancellation
        const { rows } = await pool.query(
          'SELECT * FROM user_licenses WHERE stripe_subscription_id = $1',
          [subscription.id]
        );
        
        if (rows.length > 0) {
          const license = rows[0];
          
          // Mark license as expired
          await UserLicense.update(license.id, {
            status: 'expired',
            payment_details: {
              ...license.payment_details,
              cancelled_at: new Date().toISOString(),
              cancellation_reason: subscription.cancellation_reason || 'customer_cancelled'
            }
          });
          
          // Update company license counts
          await updateCompanyLicenseCounts(license.company_id);
        }
        break;
      }
      
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        
        // Handle payment intent success for license purchase
        if (paymentIntent.metadata && paymentIntent.metadata.license_id) {
          const licenseId = parseInt(paymentIntent.metadata.license_id);
          
          // Update license status to active
          await UserLicense.update(licenseId, {
            status: 'active',
            payment_details: {
              ...paymentIntent.metadata,
              stripe_payment_intent_id: paymentIntent.id,
              payment_status: paymentIntent.status,
              customer_email: paymentIntent.receipt_email || paymentIntent.metadata.user_email,
              is_edited_license: paymentIntent.metadata.is_edit === 'true'
            }
          });

          // Update company license counts
          const updatedLicense = await UserLicense.findById(licenseId);
          if (updatedLicense) {
            await updateCompanyLicenseCounts(updatedLicense.company_id);
          }
        }
        break;
      }
      
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        
        // Handle payment failure
        if (paymentIntent.metadata && paymentIntent.metadata.license_id) {
          const licenseId = parseInt(paymentIntent.metadata.license_id);
          
          // Update license status to failed
          await UserLicense.update(licenseId, {
            status: 'failed',
            payment_details: {
              ...paymentIntent.metadata,
              stripe_payment_intent_id: paymentIntent.id,
              payment_status: paymentIntent.status,
              failure_reason: paymentIntent.last_payment_error?.message
            }
          });
        }
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

/**
 * Create a new license
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createLicense = async (req, res) => {
  try {
    const {
      company_id,
      product_ids,
      license_count,
      total_price,
      payment_method,
      payment_details,
      status = 'pending',
      is_link_generation = false // New flag to allow credit_card for link generation
    } = req.body;
    
    // Validate required fields
    if (!company_id || !product_ids || !license_count || !payment_method) {
      return res.status(400).json({
        success: false,
        message: 'Company ID, product IDs, license count, and payment method are required'
      });
    }
    
    // For credit card payments, redirect to Stripe payment flow (unless it's for link generation)
    if (payment_method === 'credit_card' && !is_link_generation) {
      return res.status(400).json({
        success: false,
        message: 'For credit card payments, use the createCheckoutSession or createPaymentIntent endpoints'
      });
    }
    
    // Create license in database for non-credit card payments or link generation
    const license = await UserLicense.create({
      company_id,
      product_ids,
      license_count,
      total_price,
      payment_method,
      payment_details: payment_details || {},
      status,
      created_by: req.user.id
    });
    
    // Send email notification for manual payment methods (not for link generation)
    if (payment_method !== 'credit_card' && !is_link_generation) {
      await sendLicenseNotificationEmail(license);
    }
    
    return res.status(201).json({
      success: true,
      license
    });
  } catch (error) {
    return handleError(res, error, 'Failed to create license');
  }
};

/**
 * Update a license
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.updateLicense = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      company_id,
      product_ids,
      license_count,
      total_price,
      payment_method,
      payment_details,
      status
    } = req.body;
    
    // Check if license exists
    const existingLicense = await UserLicense.findById(id);
    if (!existingLicense) {
      return res.status(404).json({
        success: false,
        message: 'License not found'
      });
    }
    
    // Store previous status to check if we need to update company counts
    const previousStatus = existingLicense.status;
    const wasActive = previousStatus === 'active';
    const willBeActive = status === 'active';
    
    // Update license in database
    const license = await UserLicense.update(id, {
      company_id,
      product_ids,
      license_count,
      total_price,
      payment_method,
      payment_details,
      status
    });
    
    // Update company license counts if status changed from/to active
    if (wasActive !== willBeActive) {
      await updateCompanyLicenseCounts(company_id);
    }
    
    return res.status(200).json({
      success: true,
      license
    });
  } catch (error) {
    return handleError(res, error, 'Failed to update license');
  }
};

/**
 * Delete a license
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.deleteLicense = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if license exists
    const existingLicense = await UserLicense.findById(id);
    if (!existingLicense) {
      return res.status(404).json({
        success: false,
        message: 'License not found'
      });
    }
    
    // Store company_id and status before deletion for updating company counts
    const companyId = existingLicense.company_id;
    const wasActive = existingLicense.status === 'active';
    const stripeSubscriptionId = existingLicense.stripe_subscription_id;
    
    // Cancel Stripe subscription if it exists
    if (stripeSubscriptionId) {
      try {
        const stripe = stripeConfig.getStripe();
        const cancelledSubscription = await stripe.subscriptions.cancel(stripeSubscriptionId);
        console.log(`✅ Stripe subscription ${stripeSubscriptionId} cancelled successfully`);
        console.log(`📅 Cancelled at: ${new Date().toISOString()}`);
        console.log(`💰 Subscription status: ${cancelledSubscription.status}`);
        console.log(`🆔 Customer ID: ${cancelledSubscription.customer}`);
        
        // You could also log to a database table for audit trail
        await logSubscriptionCancellation({
          license_id: id,
          stripe_subscription_id: stripeSubscriptionId,
          cancelled_at: new Date(),
          cancelled_by: req.user?.id || 'admin',
          subscription_status: cancelledSubscription.status,
          customer_id: cancelledSubscription.customer
        });
        
      } catch (stripeError) {
        console.error('❌ Error cancelling Stripe subscription:', stripeError);
        console.error('🔍 Error details:', {
          subscription_id: stripeSubscriptionId,
          error_code: stripeError.code,
          error_message: stripeError.message
        });
        // Continue with license deletion even if Stripe cancellation fails
      }
    } else {
      console.log(`ℹ️ No Stripe subscription found for license ${id}`);
    }
    
    // Delete license from database
    await UserLicense.delete(id);
    
    // If the deleted license was active, update company license counts
    if (wasActive) {
      await updateCompanyLicenseCounts(companyId);
    }
    
    return res.status(200).json({
      success: true,
      message: 'License deleted successfully'
    });
  } catch (error) {
    return handleError(res, error, 'Failed to delete license');
  }
};

/**
 * Get all active products for license selection
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getActiveProducts = async (req, res) => {
  try {
    const products = await Product.findAll(true); // true = only active products
    
    return res.status(200).json({
      success: true,
      products
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get active products');
  }
};

/**
 * Generate payment link for a license (for copying - no email sent)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.generatePaymentLink = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      company_id, 
      product_ids, 
      license_count, 
      total_price 
    } = req.body;
    
    // Check if license exists
    const existingLicense = await UserLicense.findById(id);
    if (!existingLicense) {
      return res.status(404).json({
        success: false,
        message: 'License not found'
      });
    }

    // Check if license is pending
    if (existingLicense.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment link can only be generated for pending licenses'
      });
    }

    // If updated details are provided, use them; otherwise use existing license details
    const licenseDetails = {
      company_id: company_id || existingLicense.company_id,
      product_ids: product_ids || existingLicense.product_ids,
      license_count: license_count || existingLicense.license_count,
      total_price: total_price || existingLicense.total_price
    };

    // Create Stripe checkout session (without customer_email for link generation)
    const stripe = stripeConfig.getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `License Purchase - ${licenseDetails.license_count} licenses`,
            description: `License purchase for company ID: ${licenseDetails.company_id}`,
          },
          unit_amount: Math.round(licenseDetails.total_price * 100), // Convert to cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${stripeConfig.getClientUrl()}/admin/user-licenses?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${stripeConfig.getClientUrl()}/admin/user-licenses?canceled=true`,
      metadata: {
        license_id: existingLicense.id.toString(),
        company_id: licenseDetails.company_id.toString(),
        user_id: req.user.id.toString(),
        user_email: req.user.email, // Store user email in metadata
        product_ids: JSON.stringify(licenseDetails.product_ids),
        license_count: licenseDetails.license_count.toString(),
        link_type: 'generated' // Mark this as a generated link
      }
    });

    // Update license with payment link
    const paymentLink = session.url;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    await UserLicense.update(id, {
      payment_link: paymentLink,
      payment_link_expires_at: expiresAt
    });

    return res.status(200).json({
      success: true,
      payment_link: paymentLink,
      expires_at: expiresAt,
      message: 'Payment link generated successfully. You can copy this link and share it manually.'
    });
  } catch (error) {
    return handleError(res, error, 'Failed to generate payment link');
  }
};

/**
 * Create a recurring subscription for license purchase
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.createRecurringSubscription = async (req, res) => {
  try {
    const {
      company_id,
      product_ids,
      license_count,
      total_price,
      payment_details,
      existing_license_id
    } = req.body;

    // Validate required fields
    if (!company_id || !product_ids || !license_count || !total_price) {
      return res.status(400).json({
        success: false,
        message: 'Company ID, product IDs, license count, and total price are required'
      });
    }

    let license;

    if (existing_license_id) {
      // Update existing license for editing
      license = await UserLicense.update(existing_license_id, {
        company_id,
        product_ids,
        license_count,
        total_price,
        payment_method: 'credit_card',
        payment_details: payment_details || {},
        status: 'pending',
        is_recurring: true,
        billing_interval: 'month'
      });
    } else {
      // Create a new license record with pending status
      license = await UserLicense.create({
        company_id,
        product_ids,
        license_count,
        total_price,
        payment_method: 'credit_card',
        payment_details: payment_details || {},
        status: 'pending',
        created_by: req.user.id,
        is_recurring: true,
        billing_interval: 'month'
      });
    }

    // Get the first product to get its Stripe price ID
    const stripe = stripeConfig.getStripe();
    const product = await stripe.products.retrieve(product_ids[0], {
      expand: ['default_price']
    });
    
    if (!product || !product.default_price) {
      return res.status(400).json({
        success: false,
        message: 'Product not found or no default price configured'
      });
    }

    // Create Stripe checkout session for subscription
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: req.user.email,
      line_items: [{
        price: product.default_price.id, // Use the default price ID from Stripe
        quantity: license_count,
      }],
      mode: 'subscription', // Changed from 'payment' to 'subscription'
      success_url: `${stripeConfig.getClientUrl()}/admin/user-licenses?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${stripeConfig.getClientUrl()}/admin/user-licenses?canceled=true`,
      metadata: {
        license_id: license.id.toString(),
        company_id: company_id.toString(),
        user_id: req.user.id.toString(),
        user_email: req.user.email,
        product_ids: JSON.stringify(product_ids),
        license_count: license_count.toString(),
        is_edit: existing_license_id ? 'true' : 'false',
        is_recurring: 'true'
      }
    });

    // Update license with payment link
    const paymentLink = session.url;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 24 hours from now
    
    await UserLicense.update(license.id, {
      payment_link: paymentLink,
      payment_link_expires_at: expiresAt
    });

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      checkout_url: session.url,
      license_id: license.id,
      is_recurring: true,
      billing_interval: 'month'
    });
  } catch (error) {
    return handleError(res, error, 'Failed to create recurring subscription');
  }
};

/**
 * Send email notification for new license
 * @param {Object} license - License object
 */
const sendLicenseNotificationEmail = async (license) => {
  try {
    // This is a placeholder - implement actual email sending logic
    // using your preferred email service
    const transporter = nodemailer.createTransport({
      // Configure your email provider here
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.ADMIN_EMAIL,
      subject: 'New License Order Received',
      html: `
        <h1>New License Order</h1>
        <p>A new license order has been received with the following details:</p>
        <ul>
          <li>Company ID: ${license.company_id}</li>
          <li>License Count: ${license.license_count}</li>
          <li>Total Price: $${license.total_price}</li>
          <li>Payment Method: ${license.payment_method}</li>
        </ul>
        <p>Please process this order accordingly.</p>
      `
    });
  } catch (error) {
    console.error('Failed to send license notification email:', error);
  }
};

/**
 * Send payment link via email (optional feature for future use)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.sendPaymentLinkEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const { recipient_email, custom_message } = req.body;
    
    // Check if license exists
    const existingLicense = await UserLicense.findById(id);
    if (!existingLicense) {
      return res.status(404).json({
        success: false,
        message: 'License not found'
      });
    }

    // Check if license has a payment link
    if (!existingLicense.payment_link) {
      return res.status(400).json({
        success: false,
        message: 'No payment link available for this license'
      });
    }

    // Send email with payment link
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: recipient_email,
      subject: 'Payment Link for License Purchase',
      html: `
        <h1>License Payment Link</h1>
        <p>${custom_message || 'Please use the link below to complete your license purchase:'}</p>
        <p><strong>License Details:</strong></p>
        <ul>
          <li>License Count: ${existingLicense.license_count}</li>
          <li>Total Price: $${existingLicense.total_price}</li>
          <li>Status: ${existingLicense.status}</li>
        </ul>
        <p><a href="${existingLicense.payment_link}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Complete Payment</a></p>
        <p>Or copy this link: ${existingLicense.payment_link}</p>
        <p><small>This link expires on ${new Date(existingLicense.payment_link_expires_at).toLocaleString()}</small></p>
      `
    });

    return res.status(200).json({
      success: true,
      message: 'Payment link sent via email successfully'
    });
  } catch (error) {
    return handleError(res, error, 'Failed to send payment link email');
  }
};

// Helper to update company license counts
async function updateCompanyLicenseCounts(company_id) {
  // Sum all active licenses for this company
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(license_count), 0) AS total FROM user_licenses WHERE company_id = $1 AND status = 'active'`,
    [company_id]
  );
  const available = parseInt(rows[0].total, 10) || 0;
  // For now, total_purchased_licenses = available (unless you want to track expired/cancelled separately)
  await pool.query(
    `UPDATE company SET available_licenses = $1, total_purchased_licenses = $1 WHERE id = $2`,
    [available, company_id]
  );
}

// Helper to log subscription cancellations for audit trail
async function logSubscriptionCancellation(cancellationData) {
  try {
    // Create a simple audit log table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscription_cancellation_logs (
        id SERIAL PRIMARY KEY,
        license_id INTEGER,
        stripe_subscription_id VARCHAR(255),
        cancelled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        cancelled_by VARCHAR(100),
        subscription_status VARCHAR(50),
        customer_id VARCHAR(255),
        notes TEXT
      )
    `);
    
    // Insert the cancellation log
    await pool.query(`
      INSERT INTO subscription_cancellation_logs 
      (license_id, stripe_subscription_id, cancelled_at, cancelled_by, subscription_status, customer_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      cancellationData.license_id,
      cancellationData.stripe_subscription_id,
      cancellationData.cancelled_at,
      cancellationData.cancelled_by,
      cancellationData.subscription_status,
      cancellationData.customer_id
    ]);
    
    console.log(`📝 Cancellation logged to database for license ${cancellationData.license_id}`);
  } catch (error) {
    console.error('❌ Error logging cancellation to database:', error);
    // Don't throw error - logging failure shouldn't stop the main process
  }
}

/**
 * Get subscription cancellation logs for audit trail
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getCancellationLogs = async (req, res) => {
  try {
    const { page = 1, per_page = 20 } = req.query;
    const offset = (page - 1) * per_page;
    
    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) FROM subscription_cancellation_logs');
    const totalCount = parseInt(countResult.rows[0].count);
    
    // Get paginated logs
    const { rows } = await pool.query(`
      SELECT 
        scl.*,
        ul.company_id,
        c.name as company_name
      FROM subscription_cancellation_logs scl
      LEFT JOIN user_licenses ul ON scl.license_id = ul.id
      LEFT JOIN company c ON ul.company_id = c.id
      ORDER BY scl.cancelled_at DESC
      LIMIT $1 OFFSET $2
    `, [per_page, offset]);
    
    return res.status(200).json({
      success: true,
      logs: rows,
      pagination: {
        page: parseInt(page),
        per_page: parseInt(per_page),
        total: totalCount,
        total_pages: Math.ceil(totalCount / per_page)
      }
    });
  } catch (error) {
    return handleError(res, error, 'Failed to get cancellation logs');
  }
};

/**
 * Verify Stripe checkout session and update license status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
// exports.verifySession = async (req, res) => {
//   try {
//     const { sessionId } = req.body;

//     if (!sessionId) {
//       return res.status(400).json({
//         success: false,
//         message: 'Session ID is required'
//       });
//     }

//     // Verify session with Stripe
//     const stripe = stripeConfig.getStripe();
//     const session = await stripe.checkout.sessions.retrieve(sessionId);

//     if (session.payment_status !== 'paid') {
//       return res.status(400).json({
//         success: false,
//         message: 'Payment has not been completed'
//       });
//     }

//     // If session has license metadata, update the license
//     if (session.metadata && session.metadata.license_id) {
//       const licenseId = parseInt(session.metadata.license_id);
      
//       // Check if this is a recurring subscription
//       const isRecurring = session.metadata.is_recurring === 'true';
      
//       // Update license status to active
//       await UserLicense.update(licenseId, {
//         status: 'active',
//         payment_details: {
//           ...session.metadata,
//           stripe_session_id: session.id,
//           payment_status: 'completed',
//           customer_email: session.customer_details?.email || session.metadata.user_email,
//           is_edited_license: session.metadata.is_edit === 'true'
//         }
//       });

//       // If recurring, get subscription details and update next billing date
//       if (isRecurring && session.subscription) {
//         const subscription = await stripe.subscriptions.retrieve(session.subscription);
//         await UserLicense.update(licenseId, {
//           stripe_subscription_id: subscription.id,
//           next_billing_date: new Date(subscription.current_period_end * 1000)
//         });
//       }

//       // Update company license counts
//       const updatedLicense = await UserLicense.findById(licenseId);
//       if (updatedLicense) {
//         await updateCompanyLicenseCounts(updatedLicense.company_id);
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: 'Session verified and license updated successfully'
//     });
//   } catch (error) {
//     return handleError(res, error, 'Failed to verify session');
//   }
// };

