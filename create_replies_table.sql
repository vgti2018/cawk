-- Create replies table for the board application
CREATE TABLE IF NOT EXISTS replies (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image TEXT,
  votes INTEGER DEFAULT 0,
  reports INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  user_ip TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_replies_post_id ON replies(post_id);
CREATE INDEX IF NOT EXISTS idx_replies_created_at ON replies(created_at ASC);
CREATE INDEX IF NOT EXISTS idx_replies_votes ON replies(votes DESC);
CREATE INDEX IF NOT EXISTS idx_replies_reports ON replies(reports);

-- Enable Row Level Security (RLS)
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (you can modify this for more security)
CREATE POLICY "Allow all operations" ON replies
  FOR ALL USING (true) WITH CHECK (true);

-- Optional: Create a function to automatically delete replies with 10+ reports after 24 hours
CREATE OR REPLACE FUNCTION cleanup_reported_replies()
RETURNS void AS $$
BEGIN
  DELETE FROM replies 
  WHERE reports >= 10 
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql; 