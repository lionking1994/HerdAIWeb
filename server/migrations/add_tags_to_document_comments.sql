-- Add tags column to document_comments table
ALTER TABLE document_comments ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add mentioned_users column to document_comments table
ALTER TABLE document_comments ADD COLUMN IF NOT EXISTS mentioned_users JSONB;

-- Create index for tags
CREATE INDEX IF NOT EXISTS idx_document_comments_tags ON document_comments USING GIN (tags);

-- Create index for mentioned_users
CREATE INDEX IF NOT EXISTS idx_document_comments_mentioned_users ON document_comments USING GIN (mentioned_users);

-- Add comment notifications table
CREATE TABLE IF NOT EXISTS comment_notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::VARCHAR,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    comment_id INTEGER REFERENCES document_comments(id) ON DELETE CASCADE,
    document_id VARCHAR(255) NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for comment_notifications
CREATE INDEX IF NOT EXISTS idx_comment_notifications_user_id ON comment_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_comment_notifications_comment_id ON comment_notifications(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_notifications_document_id ON comment_notifications(document_id);
CREATE INDEX IF NOT EXISTS idx_comment_notifications_is_read ON comment_notifications(is_read);

