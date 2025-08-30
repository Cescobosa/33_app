// pages/artists/index.tsx
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import Layout from '../../components/Layout';
import Button from '../../components/Button';

type ArtistLite = {
  id: string;
  stage_name: string | null;
  photo_url: string | null;
  contract_type: 'General' | 'Booking' | null;
  is_group: boolean | null;
  is_archived?: boolean | null;
  is_deleted?: boolean | null;
};

export default function ArtistsIndex() {
  const [all, setAll] = useState<ArtistLite[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);

  async function load() {
    setLoading(true); setErr(null);
    const { data, error } = await supabase
      .from('artists')
      .select('id, stage_name, photo_url, contract_type, is_group, is_archived, is_deleted')
      .neq('is_deleted', true)     // ⬅️ NO eliminados
      .neq('is_archived', true)    // ⬅️ NO archivados
      .order('stage_name', { ascending: true });
    if (error) setErr(error.message);
    setAll(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return all;
    return all.filter(a => (a.stage_name || '').toLowerCase().includes(t));
  }, [q, all]);

  return (
    <Layout>
      <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginBottom:8}}>
        <Link href="/artists/archived"><Button>Artistas archivados</Button></Link>
        <Link href="/artists/new"><Button icon="plus">Añadir artista</Button></Link>
      </div>

      <div className="module">
        <h2>Artistas</h2>
        <input
          placeholder="Buscar artista…"
          value={q}
          onChange={e=>setQ(e.target.value)}
          style={{width:'100%', marginBottom:12}}
        />

        {loading ? <div>Cargando…</div> : null}
        {err ? <div style={{color:'#d42842'}}>Error: {err}</div> : null}

        <div className="cards-grid">
          {filtered.map(a => (
            <Link key={a.id} href={`/artists/${a.id}`}>
              <div className="card hover">
                <div className="row" style={{alignItems:'center', gap:12}}>
                  <div style={{width:56, height:56, borderRadius:12, background:'#f3f4f6', overflow:'hidden'}}>
                    {a.photo_url ? <img src={a.photo_url} alt={a.stage_name || ''} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : null}
                  </div>
                  <div style={{fontWeight:600}}>{a.stage_name || '—'}</div>
                </div>
              </div>
            </Link>
          ))}
          {(!loading && filtered.length===0) ? <small>No hay artistas.</small> : null}
        </div>
      </div>
    </Layout>
  );
}
