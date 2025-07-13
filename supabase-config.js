// Supabase configuration
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = 'https://mmqbxnvgjoavgjtdfrze.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1tcWJ4bnZnam9hdmdqdGRmcnplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTYyNDMwNywiZXhwIjoyMDY3MjAwMzA3fQ.W60vDgrsAT5xv3x2eh3YcGgcEmgqudnotUK5nN-RUEk'

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey)

export { supabase } 