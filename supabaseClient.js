// Supabase Client Configuration
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://kdyjvqjzmbknfntmgiqr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkeWp2cWp6bWJrbmZudG1naXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjgxMzcsImV4cCI6MjA4OTA0NDEzN30.Ln61D_iprEAZY9aiknAKuXvnlNxz1J1KeQr6_OTPaSU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
