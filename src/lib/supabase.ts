import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xxbxstfxgtkmtxskwvyh.supabase.co';

// PASTE YOUR COPIED "anon public" KEY (starts with eyJ...) HERE:
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4YnhzdGZ4Z3RrbXR4c2t3dnloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNjk3MTIsImV4cCI6MjEwMzk0NTcxMn0.1p3i9xHtnNd7jd88bdkUCj_KzDsklTsHlzAlgHRUF_g';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});