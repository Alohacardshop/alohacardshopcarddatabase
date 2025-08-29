export default function MissingSupabaseConfig() {
  return (
    <div className="mx-auto max-w-xl p-6 text-sm">
      <h1 className="text-xl font-semibold mb-2">Supabase not configured</h1>
      <p className="mb-3">
        Set the following Vite env vars and rebuild:
      </p>
      <pre className="bg-gray-100 p-3 rounded text-xs">
{`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY`}
      </pre>
      <ul className="list-disc ml-5 mt-3 space-y-1">
        <li>In Loveable: add these in Project → Environment variables (or Secrets).</li>
        <li>Locally: put them in a <code>.env.local</code> file at repo root.</li>
      </ul>
    </div>
  );
}