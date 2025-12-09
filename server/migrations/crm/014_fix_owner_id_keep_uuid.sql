-- Migration to fix owner_id column - keep it as UUID while ensuring other columns are INTEGER
-- This migration corrects the previous migration that incorrectly tried to convert owner_id

-- Step 1: Check if owner_id columns exist and are UUID type
-- If they were incorrectly converted to INTEGER, revert them back to UUID

-- For opportunities table
DO $$
BEGIN
    -- Check if owner_id is INTEGER and needs to be reverted to UUID
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'opportunities' 
        AND column_name = 'owner_id' 
        AND data_type = 'integer'
    ) THEN
        -- Add new UUID column
        ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS owner_id_new UUID;
        
        -- Drop the INTEGER column
        ALTER TABLE opportunities DROP COLUMN owner_id;
        
        -- Rename the new UUID column
        ALTER TABLE opportunities RENAME COLUMN owner_id_new TO owner_id;
        
        RAISE NOTICE 'Reverted opportunities.owner_id back to UUID type';
    END IF;
END $$;

-- For accounts table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'accounts' 
        AND column_name = 'owner_id' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE accounts ADD COLUMN IF NOT EXISTS owner_id_new UUID;
        ALTER TABLE accounts DROP COLUMN owner_id;
        ALTER TABLE accounts RENAME COLUMN owner_id_new TO owner_id;
        RAISE NOTICE 'Reverted accounts.owner_id back to UUID type';
    END IF;
END $$;

-- For contacts table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'contacts' 
        AND column_name = 'owner_id' 
        AND data_type = 'integer'
    ) THEN
        ALTER TABLE contacts ADD COLUMN IF NOT EXISTS owner_id_new UUID;
        ALTER TABLE contacts DROP COLUMN owner_id;
        ALTER TABLE contacts RENAME COLUMN owner_id_new TO owner_id;
        RAISE NOTICE 'Reverted contacts.owner_id back to UUID type';
    END IF;
END $$;

-- Step 2: Ensure tenant_id, created_by, and updated_by are INTEGER
-- Check opportunities table
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'opportunities' 
        AND column_name = 'tenant_id' 
        AND data_type != 'integer'
    ) THEN
        RAISE EXCEPTION 'opportunities.tenant_id is not INTEGER type. Please run the main migration first.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'opportunities' 
        AND column_name = 'created_by' 
        AND data_type != 'integer'
    ) THEN
        RAISE EXCEPTION 'opportunities.created_by is not INTEGER type. Please run the main migration first.';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'opportunities' 
        AND column_name = 'updated_by' 
        AND data_type != 'integer'
    ) THEN
        RAISE EXCEPTION 'opportunities.updated_by is not INTEGER type. Please run the main migration first.';
    END IF;
    
    RAISE NOTICE 'All required columns in opportunities table are correctly typed';
END $$;

-- Step 3: Add comments for documentation
COMMENT ON COLUMN opportunities.owner_id IS 'User ID who owns the opportunity (UUID type)';
COMMENT ON COLUMN accounts.owner_id IS 'User ID who owns the account (UUID type)';
COMMENT ON COLUMN contacts.owner_id IS 'User ID who owns the contact (UUID type)';

-- Step 4: Verify the final schema
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name IN ('opportunities', 'accounts', 'contacts')
AND column_name IN ('tenant_id', 'created_by', 'updated_by', 'owner_id')
ORDER BY table_name, column_name;
