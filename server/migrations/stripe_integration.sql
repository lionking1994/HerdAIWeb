-- Add Stripe customer ID to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS meeting_count INTEGER DEFAULT 0;

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  interval VARCHAR(50) NOT NULL DEFAULT 'month',
  stripe_product_id VARCHAR(255) NOT NULL,
  stripe_price_id VARCHAR(255) NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  features JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index on stripe_product_id
CREATE INDEX IF NOT EXISTS idx_products_stripe_product_id ON products(stripe_product_id);

-- Update subscriptions table
ALTER TABLE subscriptions DROP COLUMN IF EXISTS type;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS product_id INTEGER REFERENCES products(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_data JSONB;

-- Add index on subscription_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_id ON subscriptions(subscription_id);

-- Add index on user_id
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);

-- Insert default products
INSERT INTO products (
  name, 
  description, 
  price, 
  interval, 
  stripe_product_id, 
  stripe_price_id, 
  is_enabled, 
  features
)
VALUES 
(
  'Agent License', 
  'AI agent for meeting summaries and action items', 
  29.99, 
  'month', 
  'prod_placeholder_agent', 
  'price_placeholder_agent', 
  true, 
  '["AI meeting assistant", "Automated summaries", "Action item tracking", "Unlimited meetings"]'::jsonb
),
(
  'Single User License', 
  'Full platform access for a single user', 
  49.99, 
  'month', 
  'prod_placeholder_user', 
  'price_placeholder_user', 
  true, 
  '["Full platform access", "Meeting analytics", "Custom integrations", "Priority support"]'::jsonb
)
ON CONFLICT (stripe_product_id) DO NOTHING;
