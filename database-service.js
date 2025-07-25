import { supabase } from './supabase-config.js'

// Database service for posts and replies
class DatabaseService {
  constructor() {
    this.posts = []
    this.replies = []
    this.subscription = null
    this.repliesSubscription = null
  }

  // Initialize database and set up real-time subscription
  async init() {
    try {
      // Create posts table if it doesn't exist
      await this.createPostsTable()
      
      // Create replies table if it doesn't exist
      await this.createRepliesTable()
      
      // Load initial posts and replies
      await this.loadPosts()
      await this.loadReplies()
      
      // Set up real-time subscriptions
      this.setupRealtimeSubscription()
      this.setupRepliesRealtimeSubscription()
      
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

  // Create replies table
  async createRepliesTable() {
    try {
      const { error: createError } = await supabase
        .from('replies')
        .select('id')
        .limit(1)
      
      if (createError && createError.code === '42P01') {
        // Table doesn't exist, create it
        const { error: sqlError } = await supabase.rpc('exec_sql', {
          sql: `
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
          `
        })
        
        if (sqlError) {
          console.warn('Could not create replies table via RPC, table may already exist:', sqlError)
        }
      }
    } catch (error) {
      console.warn('Replies table creation check failed:', error)
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
      
      // Convert database format to local format
      this.posts = (data || []).map(post => ({
        id: post.id,
        board: post.board,
        content: post.content,
        image: post.image,
        votes: post.votes,
        reports: post.reports,
        createdAt: new Date(post.created_at).getTime(), // Convert to timestamp
        tags: post.tags || [],
        userIp: post.user_ip
      }))
      
      console.log(`Loaded ${this.posts.length} posts from database`)
    } catch (error) {
      console.error('Error loading posts:', error)
    }
  }

  // Load replies from database
  async loadReplies() {
    try {
      const { data, error } = await supabase
        .from('replies')
        .select('*')
        .order('created_at', { ascending: true })
      
      if (error) {
        console.error('Error loading replies:', error)
        return
      }
      
      // Convert database format to local format
      this.replies = (data || []).map(reply => ({
        id: reply.id,
        postId: reply.post_id,
        content: reply.content,
        image: reply.image,
        votes: reply.votes,
        reports: reply.reports,
        createdAt: new Date(reply.created_at).getTime(),
        tags: reply.tags || [],
        userIp: reply.user_ip
      }))
      
      console.log(`Loaded ${this.replies.length} replies from database`)
    } catch (error) {
      console.error('Error loading replies:', error)
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

  // Set up real-time subscription for replies
  setupRepliesRealtimeSubscription() {
    this.repliesSubscription = supabase
      .channel('replies_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'replies' 
        }, 
        (payload) => {
          console.log('Replies database change:', payload)
          this.handleRepliesDatabaseChange(payload)
        }
      )
      .subscribe()
  }

  // Handle database changes
  handleDatabaseChange(payload) {
    // Convert database format to local format
    const convertPost = (post) => ({
      id: post.id,
      board: post.board,
      content: post.content,
      image: post.image,
      votes: post.votes,
      reports: post.reports,
      createdAt: new Date(post.created_at).getTime(),
      tags: post.tags || [],
      userIp: post.user_ip
    })

    switch (payload.eventType) {
      case 'INSERT':
        this.posts.unshift(convertPost(payload.new))
        break
      case 'UPDATE':
        const updateIndex = this.posts.findIndex(p => p.id === payload.new.id)
        if (updateIndex !== -1) {
          this.posts[updateIndex] = convertPost(payload.new)
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

  // Handle replies database changes
  handleRepliesDatabaseChange(payload) {
    // Convert database format to local format
    const convertReply = (reply) => ({
      id: reply.id,
      postId: reply.post_id,
      content: reply.content,
      image: reply.image,
      votes: reply.votes,
      reports: reply.reports,
      createdAt: new Date(reply.created_at).getTime(),
      tags: reply.tags || [],
      userIp: reply.user_ip
    })

    switch (payload.eventType) {
      case 'INSERT':
        this.replies.push(convertReply(payload.new))
        break
      case 'UPDATE':
        const updateIndex = this.replies.findIndex(r => r.id === payload.new.id)
        if (updateIndex !== -1) {
          this.replies[updateIndex] = convertReply(payload.new)
        }
        break
      case 'DELETE':
        this.replies = this.replies.filter(r => r.id !== payload.old.id)
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
      
      // Convert to local format
      return {
        id: data[0].id,
        board: data[0].board,
        content: data[0].content,
        image: data[0].image,
        votes: data[0].votes,
        reports: data[0].reports,
        createdAt: new Date(data[0].created_at).getTime(),
        tags: data[0].tags || [],
        userIp: data[0].user_ip
      }
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
      
      // Convert to local format
      return {
        id: data[0].id,
        board: data[0].board,
        content: data[0].content,
        image: data[0].image,
        votes: data[0].votes,
        reports: data[0].reports,
        createdAt: new Date(data[0].created_at).getTime(),
        tags: data[0].tags || [],
        userIp: data[0].user_ip
      }
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

  // Add a new reply
  async addReply(replyData) {
    try {
      const { data, error } = await supabase
        .from('replies')
        .insert([{
          post_id: replyData.postId,
          content: replyData.content,
          image: replyData.image,
          votes: 0,
          reports: 0,
          tags: replyData.tags,
          user_ip: replyData.userIp
        }])
        .select()
      
      if (error) {
        console.error('Error adding reply:', error)
        return null
      }
      
      console.log('Reply added successfully:', data[0])
      
      // Convert to local format
      return {
        id: data[0].id,
        postId: data[0].post_id,
        content: data[0].content,
        image: data[0].image,
        votes: data[0].votes,
        reports: data[0].reports,
        createdAt: new Date(data[0].created_at).getTime(),
        tags: data[0].tags || [],
        userIp: data[0].user_ip
      }
    } catch (error) {
      console.error('Error adding reply:', error)
      return null
    }
  }

  // Update a reply (for voting, reporting, etc.)
  async updateReply(replyId, updates) {
    try {
      const { data, error } = await supabase
        .from('replies')
        .update(updates)
        .eq('id', replyId)
        .select()
      
      if (error) {
        console.error('Error updating reply:', error)
        return null
      }
      
      console.log('Reply updated successfully:', data[0])
      
      // Convert to local format
      return {
        id: data[0].id,
        postId: data[0].post_id,
        content: data[0].content,
        image: data[0].image,
        votes: data[0].votes,
        reports: data[0].reports,
        createdAt: new Date(data[0].created_at).getTime(),
        tags: data[0].tags || [],
        userIp: data[0].user_ip
      }
    } catch (error) {
      console.error('Error updating reply:', error)
      return null
    }
  }

  // Delete a reply
  async deleteReply(replyId) {
    try {
      const { error } = await supabase
        .from('replies')
        .delete()
        .eq('id', replyId)
      
      if (error) {
        console.error('Error deleting reply:', error)
        return false
      }
      
      console.log('Reply deleted successfully')
      return true
    } catch (error) {
      console.error('Error deleting reply:', error)
      return false
    }
  }

  // Get replies for a specific post
  getRepliesForPost(postId) {
    return this.replies.filter(reply => reply.postId === postId)
  }

  // Vote on a reply
  async voteReply(replyId, voteDirection) {
    try {
      const reply = this.replies.find(r => r.id === replyId)
      if (!reply) return false
      
      let newVotes = reply.votes
      if (voteDirection === 'up') {
        newVotes += 1
      } else if (voteDirection === 'down') {
        newVotes -= 1
      }
      
      return await this.updateReply(replyId, { votes: newVotes })
    } catch (error) {
      console.error('Error voting on reply:', error)
      return null
    }
  }

  // Report a reply
  async reportReply(replyId) {
    try {
      const reply = this.replies.find(r => r.id === replyId)
      if (!reply) return false
      
      const newReports = reply.reports + 1
      return await this.updateReply(replyId, { reports: newReports })
    } catch (error) {
      console.error('Error reporting reply:', error)
      return null
    }
  }

  // Get all posts (for backward compatibility)
  getAllPosts() {
    return this.posts
  }

  // Get all replies (for backward compatibility)
  getAllReplies() {
    return this.replies
  }

  // Cleanup subscription
  cleanup() {
    if (this.subscription) {
      supabase.removeChannel(this.subscription)
    }
    if (this.repliesSubscription) {
      supabase.removeChannel(this.repliesSubscription)
    }
  }
}

// Create and export database service instance
const dbService = new DatabaseService()

export { dbService } 