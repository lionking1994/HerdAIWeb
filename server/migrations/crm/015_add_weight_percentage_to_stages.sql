-- Migration: Add weight_percentage column to opportunity_stages table
-- Date: 2024-01-XX
-- Description: Adds weight_percentage field for stage weighting in sales pipeline

-- Add weight_percentage column to opportunity_stages table
ALTER TABLE opportunity_stages 
ADD COLUMN IF NOT EXISTS weight_percentage NUMERIC(5,2) DEFAULT 0.00;

-- Add constraint to ensure weight_percentage is between 0 and 100
ALTER TABLE opportunity_stages 
ADD CONSTRAINT IF NOT EXISTS chk_weight_percentage_range 
CHECK (weight_percentage >= 0 AND weight_percentage <= 100);

-- Add comment for documentation
COMMENT ON COLUMN opportunity_stages.weight_percentage IS 'Percentage weight for this stage in the sales pipeline (0-100%)';

-- Update existing stages to have default weight based on order_index
-- This gives a reasonable distribution for existing data
UPDATE opportunity_stages 
SET weight_percentage = CASE 
  WHEN order_index = 1 THEN 20.00
  WHEN order_index = 2 THEN 25.00
  WHEN order_index = 3 THEN 20.00
  WHEN order_index = 4 THEN 15.00
  WHEN order_index = 5 THEN 10.00
  WHEN order_index = 6 THEN 5.00
  WHEN order_index = 7 THEN 3.00
  WHEN order_index = 8 THEN 2.00
  ELSE 1.00
END
WHERE weight_percentage = 0.00;

-- Create index for better performance on weight_percentage queries
CREATE INDEX IF NOT EXISTS idx_opportunity_stages_weight_percentage 
ON opportunity_stages(weight_percentage);
