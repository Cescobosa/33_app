// pages/artists/index.tsx
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabaseClient';
import Layout from '../../components/Layout';
import Button from '../../components/Button';

type Artist = {
  id: string;
  stage_name: string;
  photo_url: string | null;
  is_archived?: boolean | null;
};

export default function ArtistsIndex() {
  const [rows, setRows] = useState<Artist[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      // Sólo usamos is_archived (archived ya no existe)
      const { data, error } = await supabase
        .from('artists')
        .select('id, stage_name, photo_url, is_archived')
        .or('is_archived.is.false,is_archived.is.null') // por si alguna fila quedó NULL
        .order('stage_name', { ascending: true });

      if (error) throw error;
      setRows(data || []);
    } catch (e: any) {
      setErr(e.message || 'Error cargando artistas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r => (r.stage_name || '').toLowerCase().includes(term));
  }, [rows, q]);

  return (
    <Layout>
      {/* Botones arriba a la derecha, fuera de la barra de búsqueda */}
      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:8 }}>
        <Button as="a" href="/artists/archived" tone="neutral">Artistas archivados</Button>
        <Button as="a" href="/artists/new" icon="plus">Añadir artista</Button>
      </div>

      {/* Búsqueda */}
      <div className="module">
        <div className="row" style={{ alignItems:'center' }}>
          <div style={{ flex:'1 1 320px' }}>
            <input placeholder="Buscar artista…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Lista */}
      <div className="module">
        <h2>Artistas</h2>
        {loading ? <div>Cargando…</div> : null}
        {err ? <div style={{color:'#d42842'}}>Error: {err}</div> : null}
        {!loading && !err && filtered.length === 0 ? <small>No hay artistas.</small> : null}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
          {filtered.map(a => (
            <Link key={a.id} href={`/artists/${a.id}`} className="card" style={{ display:'flex', gap:12, alignItems:'center' }}>
              <div style={{ width:56, height:56, borderRadius:12, overflow:'hidden', background:'#f3f4f6' }}>
                {a.photo_url ? <img src={a.photo_url} alt={a.stage_name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/> : null}
              </div>
              <div style={{ fontWeight:600 }}>{a.stage_name || 'Sin nombre'}</div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
