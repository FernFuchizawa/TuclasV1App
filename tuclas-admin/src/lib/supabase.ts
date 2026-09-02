import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zonkkmqdbqmcwsgzkizr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cT7st6mhzv6Z13PbvcxrrA_dSmCbPLC';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);