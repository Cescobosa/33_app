// pages/artists/index.tsx
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import Button from '../../components/Button';
import { supabase } from '../../lib/supabaseClient';

type Row = { id: string; stage_name: string; photo_url: string | null; is_archived: boolean | null };

export default function ArtistsIndex() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const { data, error } = await supabase
      .from('artists')
      .select('id, stage_name, photo_url, is_archived')
      .eq('is_archived', false)
      .order('stage_name', { ascending: true });
    if (error) setErr(error.message);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => (r.stage_name || '').toLowerCase().includes(s));
  }, [rows, q]);

  return (
    <Layout>
      <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginBottom:8}}>
        <Button as="a" href="/artists/archived">Artistas archivados</Button>
        <Button as="a" href="/artists/new" icon="plus">Añadir artista</Button>
      </div>

      <div className="module">
        <h2 style={{marginTop:0}}>Artistas</h2>

        <input
          placeholder="Buscar artista…"
          value={q}
          onChange={e=>setQ(e.target.value)}
          style={{width:'100%', marginBottom:12}}
        />

        {loading && <div>Cargando…</div>}
        {err && <div style={{color:'#d42842'}}>Error: {err}</div>}
        {!loading && !err && filtered.length === 0 && <small>No hay artistas.</small>}

        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px,1fr))', gap:12}}>
          {filtered.map(a=>(
            <Link key={a.id} href={`/artists/${a.id}`} className="card" style={{display:'flex', alignItems:'center', gap:12, textDecoration:'none'}}>
              <div style={{width:56, height:56, borderRadius:12, overflow:'hidden', background:'#f3f4f6'}}>
                {a.photo_url && <img src={a.photo_url} alt={a.stage_name} style={{width:'100%', height:'100%', objectFit:'cover'}}/>}
              </div>
              <div style={{fontWeight:600}}>{a.stage_name}</div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
