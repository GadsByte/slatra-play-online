import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://bkmxldaoubjujthbqwap.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrbXhsZGFvdWJqdWp0aGJxd2FwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNTA4MjAsImV4cCI6MjA5MDgyNjgyMH0.LkWjKuU9uahSbn4jxzzG0FazVK0nJDl2sbfR3qgkJ6g";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
