'use strict';
const sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(error.message); return data; };
const me = async () => {
  const { data: { session } } = await sb.auth.getSession(); if (!session) return null;
  const { data, error } = await sb.from('profiles').select('*').eq('id', session.user.id).single(); if (error) throw error;
  return { id: data.id, name: data.name, email: session.user.email, role: data.role, profile: { age: data.age, loc: data.loc, prof: data.prof, int: data.interests } };
};
const rows = async q => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };
