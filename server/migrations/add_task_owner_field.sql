-- Add task_owner_id field to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id);

-- Set default task_owner_id to meeting owner for existing tasks
UPDATE tasks 
SET owner_id = meetings.org_id
FROM meetings
WHERE tasks.meeting_id = meetings.id AND tasks.owner_id IS NULL;
