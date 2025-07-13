-- Create posts table for the board application
CREATE TABLE IF NOT EXISTS posts (
  id BIGSERIAL PRIMARY KEY,
  board TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  image TEXT,
  votes INTEGER DEFAULT 0,
  reports INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tags TEXT[] DEFAULT '{}',
  user_ip TEXT
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_posts_board ON posts(board);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_votes ON posts(votes DESC);
CREATE INDEX IF NOT EXISTS idx_posts_reports ON posts(reports);

-- Enable Row Level Security (RLS)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (you can modify this for more security)
CREATE POLICY "Allow all operations" ON posts
  FOR ALL USING (true) WITH CHECK (true);

-- Optional: Create a function to automatically delete posts with 10+ reports after 24 hours
CREATE OR REPLACE FUNCTION cleanup_reported_posts()
RETURNS void AS $$
BEGIN
  DELETE FROM posts 
  WHERE reports >= 10 
    AND created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a cron job to run cleanup every hour (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-reported-posts', '0 * * * *', 'SELECT cleanup_reported_posts();'); 