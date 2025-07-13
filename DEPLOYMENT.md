# Deploying to Vercel

This guide will help you deploy your board application to Vercel.

## Prerequisites

1. **GitHub Account**: Make sure your code is in a GitHub repository
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **Supabase Setup**: Ensure your Supabase database is configured

## Method 1: Deploy via Vercel Dashboard (Recommended)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

### Step 2: Connect to Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will automatically detect it's a static site
5. Click "Deploy"

### Step 3: Configure Environment Variables (Optional)
If you want to use environment variables for Supabase credentials:

1. In your Vercel project dashboard, go to "Settings" → "Environment Variables"
2. Add:
   - `SUPABASE_URL`: `https://mmqbxnvgjoavgjtdfrze.supabase.co`
   - `SUPABASE_ANON_KEY`: Your Supabase anon key

## Method 2: Deploy via Vercel CLI

### Step 1: Install Vercel CLI
```bash
npm install -g vercel
```

### Step 2: Login to Vercel
```bash
vercel login
```

### Step 3: Deploy
```bash
vercel --prod
```

## Method 3: One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/YOUR_REPO_NAME)

## Configuration Files

### vercel.json
This file tells Vercel how to serve your static files:
- Serves HTML, JS, and CSS files
- Handles routing for SPA
- Adds security headers

### .gitignore
Excludes unnecessary files from deployment:
- `node_modules/`
- `.env` files
- IDE files
- OS files

## Post-Deployment

### 1. Test Your Application
- Visit your Vercel URL
- Test creating posts
- Test voting and reporting
- Verify real-time updates work

### 2. Custom Domain (Optional)
1. Go to your Vercel project dashboard
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Configure DNS settings

### 3. Environment Variables
If you want to use environment variables instead of hardcoded credentials:

1. Update `supabase-config.js`:
```javascript
const supabaseUrl = process.env.SUPABASE_URL || 'https://mmqbxnvgjoavgjtdfrze.supabase.co'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-key-here'
```

2. Add environment variables in Vercel dashboard

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure your Supabase project allows your Vercel domain
2. **Module Errors**: Ensure all files are properly served
3. **Database Connection**: Verify Supabase credentials are correct

### Debug Steps:

1. Check Vercel deployment logs
2. Test locally first: `npm run dev`
3. Verify Supabase connection
4. Check browser console for errors

## Performance Optimization

### 1. Enable Caching
Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

### 2. Enable Compression
Vercel automatically compresses static files.

### 3. CDN
Vercel automatically serves files from their global CDN.

## Monitoring

### 1. Vercel Analytics
Enable in your project dashboard for performance insights.

### 2. Supabase Dashboard
Monitor database usage and performance.

### 3. Error Tracking
Consider adding error tracking (e.g., Sentry) for production.

## Security

### 1. Environment Variables
Use environment variables for sensitive data.

### 2. Supabase RLS
Configure Row Level Security in Supabase.

### 3. CORS
Configure CORS settings in Supabase for your domain.

## Updates

To update your deployed application:

1. Push changes to GitHub
2. Vercel will automatically redeploy
3. Or manually trigger: `vercel --prod`

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [GitHub Issues](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/issues) 