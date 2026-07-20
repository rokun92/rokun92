
const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

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
  return encodeURIComponent(
    str
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
  );
}
