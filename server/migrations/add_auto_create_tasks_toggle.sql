-- Add auto_create_tasks_from_activities column to company table
ALTER TABLE company ADD COLUMN IF NOT EXISTS auto_create_tasks_from_activities BOOLEAN DEFAULT false;

