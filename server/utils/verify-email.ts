import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '<SUPABASE_URL>',
  process.env.SUPABASE_ANON_KEY || '<SUPABASE_ANON_KEY>'
)

const { data, error } = await supabase.auth.admin.updateUserById(
  'adasdasdasdasdasd', // Reemplaza con el ID del usuario
  {
    email_confirm: true,
  }
)

if (error) throw error
console.log('Email confirmado:', data)