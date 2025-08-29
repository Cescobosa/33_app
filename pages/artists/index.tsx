import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../../components/Layout';
import Button from '../../components/Button';
import { supabase } from '../../lib/supabaseClient';

type Artist = {
  id: string;
  stage_name: string;
  photo_url: string | null;
  archived?: boolean | null;
};

export default function ArtistsIndex() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    let req = supabase.from('artists')
      .select('id, stage_name, photo_url, archived')
      .eq('archived', false)
      .order('stage_name', { ascending: true });

    if (q.trim()) {
      // búsqueda simple por stage_name (extiéndelo si tienes un TSVector)
      req = req.ilike('stage_name', `%${q.trim()}%`);
    }
    const { data, error } = await req;
    if (error) console.error(error);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(()=>{ load(); }, [q]);

  return (
    <Layout>
      <div className="module" style={{display:'flex', alignItems:'center', gap:12, justifyContent:'space-between'}}>
        {/* Botones a la IZQUIERDA (fuera de la barra) */}
        <div style={{display:'flex', gap:8}}>
          <Link href="/artists/archived"><Button tone="neutral">Artistas archivados</Button></Link>
          <Link href="/artists/new"><Button>+ Añadir artista</Button></Link>
        </div>

        {/* Búsqueda */}
        <div style={{flex:'1 1 auto', maxWidth:520, marginLeft:'auto'}}>
          <input
            placeholder="Buscar por nombre artístico…"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            style={{width:'100%'}}
          />
        </div>
      </div>

      <div className="module">
        {loading ? <div>Cargando…</div> : null}
        {!loading && rows.length === 0 ? <small>No hay artistas.</small> : null}
        <div className="grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:12}}>
          {rows.map(a=>(
            <Link key={a.id} href={`/artists/${a.id}`} className="card" style={{display:'flex', gap:12, alignItems:'center', textDecoration:'none'}}>
              <div style={{width:64, height:64, borderRadius:12, overflow:'hidden', background:'#f3f4f6'}}>
                {a.photo_url ? <img src={a.photo_url} alt={a.stage_name} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : null}
              </div>
              <div style={{fontWeight:600}}>{a.stage_name}</div>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
