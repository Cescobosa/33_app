// pages/partners/thirds/index.tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import Button from '../../../components/Button';
import { supabase } from '../../../lib/supabaseClient';

type Row = {
  id: string;
  nick: string|null;
  name: string|null;
  logo_url: string|null;
  unlinked: boolean|null;
  unlinked_at: string|null;
  unlinked_from_artist_id: string|null;
};

export default function ThirdsIndex(){
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('third_parties')
      .select('id, nick, name, logo_url, unlinked, unlinked_at, unlinked_from_artist_id')
      .order('nick', { ascending: true });
    setRows(data as any || []);
    setLoading(false);
  }
  useEffect(()=>{ load(); }, []);

  const filtered = rows.filter(r=>{
    const s = `${r.nick||''} ${r.name||''}`.toLowerCase();
    return s.includes(q.toLowerCase());
  });

  return (
    <Layout>
      <div className="module" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1 style={{margin:0}}>Terceros</h1>
        <Button as="a" href="/partners/providers/new">+ Añadir proveedor</Button>
      </div>

      <div className="module">
        <input
          placeholder="Buscar por nick o nombre…"
          value={q}
          onChange={e=>setQ(e.target.value)}
          style={{width:'100%'}}
        />
      </div>

      <div className="module">
        {loading ? 'Cargando…' : (
          filtered.length===0 ? <small>No hay resultados.</small> : (
            <div className="grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:12}}>
              {filtered.map(r=>(
                <Link key={r.id} href={`/partners/thirds/${r.id}`} className="card"
                  style={r.unlinked ? {border:'1px solid #ef4444'} : undefined}
                >
                  <div style={{display:'flex', gap:10, alignItems:'center'}}>
                    <div style={{ width: 48, height: 48, borderRadius: 12, overflow:'hidden', background:'#f3f4f6' }}>
                      {r.logo_url && <img src={r.logo_url} alt={r.nick || r.name || 'logo'} style={{width:'100%', height:'100%', objectFit:'cover'}}/>}
                    </div>
                    <div>
                      <div style={{fontWeight:600}}>{r.nick || r.name || 'Sin nombre'}</div>
                      {r.unlinked ? (
                        <div style={{fontSize:12, color:'#b91c1c'}}>
                          Desvinculado {r.unlinked_at ? `· ${new Date(r.unlinked_at).toLocaleDateString()}` : ''}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}
      </div>
    </Layout>
  );
}
