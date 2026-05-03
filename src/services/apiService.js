import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://kdyjvqjzmbknfntmgiqr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtkeWp2cWp6bWJrbmZudG1naXFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NjgxMzcsImV4cCI6MjA4OTA0NDEzN30.Ln61D_iprEAZY9aiknAKuXvnlNxz1J1KeQr6_OTPaSU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const authService = {
    getSession: async () => await supabase.auth.getSession(),
    signInWithPassword: async (email, password) => await supabase.auth.signInWithPassword({ email, password }),
    signInWithOAuth: async (provider, options) => await supabase.auth.signInWithOAuth({ provider, options }),
    signUp: async (email, password) => await supabase.auth.signUp({ email, password }),
    signOut: async () => await supabase.auth.signOut(),
    getProfile: async (id) => await supabase.from('profiles').select('role').eq('id', id).single(),
};

export const fileService = {
    searchFiles: async (term) => await supabase.from('files').select('*').ilike('title', `%${term}%`).order('created_at', { ascending: false }),
    getPublicUrl: (filePath) => supabase.storage.from('documents').getPublicUrl(filePath),
    uploadFile: async (path, file) => await supabase.storage.from('documents').upload(path, file),
    insertFileRecord: async (data) => await supabase.from('files').insert(data),
    getFiles: async () => await supabase.from('files').select('*').order('created_at', { ascending: false }),
    getFilesByCategory: async (category, searchTerm) => {
        let query = supabase.from('files').select('*').order('created_at', { ascending: false });
        if (category && category !== 'All') {
            query = query.eq('category', category);
        }
        if (searchTerm) {
            query = query.ilike('title', `%${searchTerm}%`);
        }
        return await query;
    }
};

export const adminService = {
    getMembers: async () => await supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    updateMemberRole: async (id, role) => await supabase.from('profiles').update({ role }).eq('id', id),
    deleteMember: async (id) => await supabase.from('profiles').delete().eq('id', id),
    deleteFile: async (id) => await supabase.from('files').delete().eq('id', id),
    deleteStorageFile: async (filePath) => await supabase.storage.from('documents').remove([filePath]),
    deleteFilesBatch: async (ids) => await supabase.from('files').delete().in('id', ids),
    deleteStorageFilesBatch: async (paths) => await supabase.storage.from('documents').remove(paths)
};
