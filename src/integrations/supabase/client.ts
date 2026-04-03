import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://kkvafmyxjbfnwxrcabut.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdmFmbXl4amJmbnд4cmNhYnV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1ODE5MjAsImV4cCI6MjA1OTE1NzkyMH0.yAflNOa_9PoIIBIYexALtKWJaX3gJYXYhNJgON6Jk44";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
