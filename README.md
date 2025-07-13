# Board Application with Supabase Database

This is a board-style application that now uses Supabase as the backend database instead of localStorage.

## Features

- Create posts with text and images
- Vote on posts (upvote/downvote)
- Report posts
- Filter by board categories (general, memes, kanye)
- Search functionality
- Real-time updates via Supabase subscriptions
- Automatic cleanup of reported posts

## Setup Instructions

### 1. Supabase Database Setup

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Open your project
3. Go to the SQL Editor
4. Copy and paste the contents of `create_posts_table.sql` and run it
5. This will create the posts table with all necessary indexes and policies

### 2. Environment Configuration

The application is already configured with your Supabase credentials in `supabase-config.js`:

- URL: `https://mmqbxnvgjoavgjtdfrze.supabase.co`
- Service Role Key: (configured in the file)

### 3. Running the Application

1. Serve the files using a local web server (required for ES6 modules)
2. Open `index.html` in your browser

You can use Python's built-in server:
```bash
python -m http.server 8000
```

Or use Node.js with a simple server:
```bash
npx serve .
```

## Database Schema

The `posts` table has the following structure:

- `id`: Primary key (auto-incrementing)
- `board`: Board category (general, memes, kanye)
- `content`: Post text content
- `image`: Base64 encoded image (optional)
- `votes`: Vote count (can be negative)
- `reports`: Number of reports
- `created_at`: Timestamp when post was created
- `tags`: Array of extracted tags from content
- `user_ip`: IP address of the user who created the post

## Features

### Real-time Updates
The application uses Supabase's real-time subscriptions to automatically update when posts are added, modified, or deleted by other users.

### Fallback Support
If the database connection fails, the application gracefully falls back to localStorage to ensure it continues working.

### Automatic Cleanup
Posts with 10 or more reports are automatically deleted after 24 hours (if you enable the cron job in Supabase).

## Security

- Row Level Security (RLS) is enabled on the posts table
- Currently allows all operations (you can modify the policy for more security)
- User IP addresses are stored for potential moderation features

## Customization

You can modify the following files to customize the application:

- `supabase-config.js`: Database connection settings
- `database-service.js`: Database operations and real-time subscriptions
- `26_board_ui.js`: Main application logic
- `28_board_ui.css`: Styling
- `index.html`: HTML structure

## Troubleshooting

1. **Module errors**: Make sure you're serving the files through a web server (not opening HTML directly)
2. **Database connection errors**: Check your Supabase credentials and network connection
3. **Real-time not working**: Ensure your Supabase project has real-time enabled
4. **CORS errors**: Make sure your Supabase project allows requests from your domain

## Migration from localStorage

The application automatically migrates existing localStorage posts to the database when it first connects. Posts created after the database integration will be stored in both the database and localStorage for redundancy. 