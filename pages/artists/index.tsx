// pages/artists/index.tsx
import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import { matches } from '../../lib/search';
import Button from '../../components/Button';
import Link from 'next/link';

type Artist = {
  id: string;
  stage_name: string;
  photo_url: string | null;
  is_archived: boolean | null;
};

export default function ArtistsIndex() {
  const [rows, setRows] = useState<Artist[]>([]);
  const [q, setQ] = useState('');

  async function load() {
    const { data } = await supabase
      .from('artists')
      .select('id, stage_name, photo_url, is_archived')
      .is('is_archived', false)
      .order('stage_name', { ascending:true });
    setRows((data||[]) as any);
  }
  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(() =>
    rows.filter(a => matches(a.stage_name, q))
  , [rows, q]);

  return (
    <Layout>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <input placeholder="Buscar artista…" value={q} onChange={e=>setQ(e.target.value)} />
        <div style={{display:'flex', gap:8}}>
          <Button as="a" href="/artists/archived" tone="neutral">Artistas archivados</Button>
          <Button as="a" href="/artists/new">+ Añadir artista</Button>
        </div>
      </div>

      <div className="module">
        <h2 style={{marginTop:0}}>Artistas</h2>
        <div style={{display:'grid', gap:12}}>
          {filtered.map(a=>(
            <Link key={a.id} href={`/artists/${a.id}`} className="card" style={{display:'flex', alignItems:'center', gap:12}}>
              <div style={{width:56,height:56, borderRadius:12, overflow:'hidden', background:'#f3f4f6'}}>
                {a.photo_url ? <img src={a.photo_url} alt={a.stage_name} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : null}
              </div>
              <div style={{fontWeight:600}}>{a.stage_name}</div>
            </Link>
          ))}
          {filtered.length===0 ? <small>No hay resultados.</small> : null}
        </div>
      </div>
    </Layout>
  )
}
