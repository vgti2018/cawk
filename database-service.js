import { supabase } from './supabase-config.js'

// Database service for posts
class DatabaseService {
  constructor() {
    this.posts = []
    this.subscription = null
  }

  // Initialize database and set up real-time subscription
  async init() {
    try {
      // Create posts table if it doesn't exist
      await this.createPostsTable()
      
      // Load initial posts
      await this.loadPosts()
      
      // Set up real-time subscription
      this.setupRealtimeSubscription()
      
      console.log('Database service initialized successfully')
    } catch (error) {
      console.error('Error initializing database service:', error)
    }
  }

  // Create posts table
  async createPostsTable() {
    try {
      const { error } = await supabase.rpc('create_posts_table_if_not_exists')
      if (error) {
        // If RPC doesn't exist, create table manually
        const { error: createError } = await supabase
          .from('posts')
          .select('id')
          .limit(1)
        
        if (createError && createError.code === '42P01') {
          // Table doesn't exist, create it
          const { error: sqlError } = await supabase.rpc('exec_sql', {
            sql: `
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
            `
          })
          
          if (sqlError) {
            console.warn('Could not create table via RPC, table may already exist:', sqlError)
          }
        }
      }
    } catch (error) {
      console.warn('Table creation check failed:', error)
    }
  }

  // Load posts from database
  async loadPosts() {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error loading posts:', error)
        return
      }
      
      this.posts = data || []
      console.log(`Loaded ${this.posts.length} posts from database`)
    } catch (error) {
      console.error('Error loading posts:', error)
    }
  }

  // Set up real-time subscription for posts
  setupRealtimeSubscription() {
    this.subscription = supabase
      .channel('posts_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'posts' 
        }, 
        (payload) => {
          console.log('Database change:', payload)
          this.handleDatabaseChange(payload)
        }
      )
      .subscribe()
  }

  // Handle database changes
  handleDatabaseChange(payload) {
    switch (payload.eventType) {
      case 'INSERT':
        this.posts.unshift(payload.new)
        break
      case 'UPDATE':
        const updateIndex = this.posts.findIndex(p => p.id === payload.new.id)
        if (updateIndex !== -1) {
          this.posts[updateIndex] = payload.new
        }
        break
      case 'DELETE':
        this.posts = this.posts.filter(p => p.id !== payload.old.id)
        break
    }
    
    // Trigger re-render if render function exists globally
    if (typeof window.render === 'function') {
      window.render()
    }
  }

  // Add a new post
  async addPost(postData) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([{
          board: postData.board,
          content: postData.content,
          image: postData.image,
          votes: 0,
          reports: 0,
          tags: postData.tags,
          user_ip: postData.userIp
        }])
        .select()
      
      if (error) {
        console.error('Error adding post:', error)
        return null
      }
      
      console.log('Post added successfully:', data[0])
      return data[0]
    } catch (error) {
      console.error('Error adding post:', error)
      return null
    }
  }

  // Update a post (for voting, reporting, etc.)
  async updatePost(postId, updates) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .update(updates)
        .eq('id', postId)
        .select()
      
      if (error) {
        console.error('Error updating post:', error)
        return null
      }
      
      console.log('Post updated successfully:', data[0])
      return data[0]
    } catch (error) {
      console.error('Error updating post:', error)
      return null
    }
  }

  // Delete a post
  async deletePost(postId) {
    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
      
      if (error) {
        console.error('Error deleting post:', error)
        return false
      }
      
      console.log('Post deleted successfully')
      return true
    } catch (error) {
      console.error('Error deleting post:', error)
      return false
    }
  }

  // Get posts with filters
  async getPosts(filters = {}) {
    let query = supabase
      .from('posts')
      .select('*')
    
    if (filters.board) {
      query = query.eq('board', filters.board)
    }
    
    if (filters.search) {
      query = query.ilike('content', `%${filters.search}%`)
    }
    
    if (filters.hideReported) {
      query = query.lt('reports', 10) // Hide posts with 10+ reports
    }
    
    query = query.order('created_at', { ascending: false })
    
    try {
      const { data, error } = await query
      
      if (error) {
        console.error('Error getting posts:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('Error getting posts:', error)
      return []
    }
  }

  // Vote on a post
  async votePost(postId, voteDirection) {
    try {
      const post = this.posts.find(p => p.id === postId)
      if (!post) return false
      
      let newVotes = post.votes
      if (voteDirection === 'up') {
        newVotes += 1
      } else if (voteDirection === 'down') {
        newVotes -= 1
      }
      
      return await this.updatePost(postId, { votes: newVotes })
    } catch (error) {
      console.error('Error voting on post:', error)
      return null
    }
  }

  // Report a post
  async reportPost(postId) {
    try {
      const post = this.posts.find(p => p.id === postId)
      if (!post) return false
      
      const newReports = post.reports + 1
      return await this.updatePost(postId, { reports: newReports })
    } catch (error) {
      console.error('Error reporting post:', error)
      return null
    }
  }

  // Get all posts (for backward compatibility)
  getAllPosts() {
    return this.posts
  }

  // Cleanup subscription
  cleanup() {
    if (this.subscription) {
      supabase.removeChannel(this.subscription)
    }
  }
}

// Create and export database service instance
const dbService = new DatabaseService()

export { dbService } 