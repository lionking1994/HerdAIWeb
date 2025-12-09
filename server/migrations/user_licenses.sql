-- Create user_licenses table
CREATE TABLE IF NOT EXISTS user_licenses (
  id SERIAL PRIMARY KEY,
  -- company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,     (In company table id is not unique)
  company_id INTEGER NOT NULL ,
  product_ids JSONB NOT NULL, -- Array of product IDs
  license_count INTEGER NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- 'credit_card', 'checking', 'ach', 'wire'
  payment_details JSONB, -- Payment-specific details
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'active', 'expired', 'cancelled'
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_licenses_company_id ON user_licenses(company_id);
CREATE INDEX IF NOT EXISTS idx_user_licenses_status ON user_licenses(status);
CREATE INDEX IF NOT EXISTS idx_user_licenses_created_at ON user_licenses(created_at);

-- Add columns to company table for license tracking
ALTER TABLE company ADD COLUMN IF NOT EXISTS available_licenses INTEGER DEFAULT 0;
ALTER TABLE company ADD COLUMN IF NOT EXISTS total_purchased_licenses INTEGER DEFAULT 0;

-- Add recurring billing fields to user_licenses table
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(50) DEFAULT 'month';
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE user_licenses ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

