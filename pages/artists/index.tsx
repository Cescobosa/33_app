import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Layout from '../../components/Layout';
import Button from '../../components/Button';

type Row = {
  id: string;
  stage_name: string;
  photo_url: string|null;
  archived: boolean|null;
};

export default function ArtistsIndex() {
  const [list, setList] = useState<Row[]>([]);
  const [q, setQ] = useState('');

  async function load() {
    const { data, error } = await supabase
      .from('artists')
      .select('id, stage_name, photo_url, archived')
      .order('stage_name', { ascending: true });
    if (error) { alert(error.message); return; }
    setList((data||[]) as any);
  }
  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(()=>{
    const t = (q||'').toLowerCase();
    return (list||[]).filter(r => !r.archived && r.stage_name.toLowerCase().includes(t));
  }, [q, list]);

  return (
    <Layout>
      <h1>Artistas</h1>

      <div className="module">
        <div className="row" style={{ alignItems:'center' }}>
          <div style={{ flex:'1 1 420px' }}>
            <input placeholder="Buscar artista…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
            <Button as="a" href="/artists/archived" tone="neutral">Artistas archivados</Button>
            <Button as="a" href="/artists/new">+ Nuevo artista</Button>
          </div>
        </div>
      </div>

      <div className="module">
        {filtered.length === 0 ? <small>No hay artistas.</small> : null}
        {filtered.map(a=>(
          <div key={a.id} className="row" style={{ borderTop:'1px solid #e5e7eb', padding:'8px 0', alignItems:'center' }}>
            <div style={{ width:48, height:48, borderRadius:12, overflow:'hidden', background:'#f3f4f6' }}>
              {a.photo_url && <img src={a.photo_url} alt={a.stage_name} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
            </div>
            <div style={{ flex:'1 1 auto' }}>
              <a href={`/artists/${a.id}`} style={{ fontWeight:600 }}>{a.stage_name}</a>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
