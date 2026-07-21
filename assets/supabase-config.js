
const SUPABASE_URL = (window.env && window.env.SUPABASE_URL);
const SUPABASE_ANON_KEY = (window.env && window.env.SUPABASE_ANON_KEY);

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


function getSessionId() {
  let id = localStorage.getItem('blog_session_id');
  if (!id) {
    id = 'anon_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('blog_session_id', id);
  }
  return id;
}

function slugify(str) {
  const text = String(str || '').trim().toLowerCase();
  const bytes = new TextEncoder().encode(text);
  let binary = '';

  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  const base64 = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return encodeURIComponent(base64);
}
