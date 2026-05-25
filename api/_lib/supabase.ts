import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL!
const key = process.env.SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)
