import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Layout from '../../../components/Layout';

type Row = {
  id: string;
  nick: string|null;
  name: string|null;
  logo_url: string|null;
  is_active: boolean;
};

export default function ThirdsIndex() {
  const [list, setList] = useState<Row[]>([]);
  const [q, setQ] = useState('');

  async function load() {
    const { data } = await supabase
      .from('third_parties')
      .select('id, nick, name, logo_url, is_active')
      .eq('kind','third')
      .order('nick', { ascending: true });
    setList((data||[]) as any);
  }

  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(()=>{
    const t = (q||'').toLowerCase();
    if (!t) return list;
    return list.filter(r =>
      (r.nick||'').toLowerCase().includes(t) ||
      (r.name||'').toLowerCase().includes(t)
    );
  }, [q, list]);

  return (
    <Layout>
      <h1>Terceros</h1>

      <div className="module">
        <div className="row" style={{ alignItems:'center' }}>
          <div style={{ flex:'1 1 420px' }}>
            <input placeholder="Buscar por nick o nombre…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          {/* Sin botón de crear: los terceros se crean desde la ficha de artista */}
        </div>
      </div>

      <div className="module">
        {filtered.length === 0 ? <small>No hay terceros.</small> : null}
        {filtered.map(r=>(
          <div key={r.id} className="row" style={{ borderTop:'1px solid #e5e7eb', padding:'8px 0', alignItems:'center' }}>
            <div style={{ width:48, height:48, borderRadius:12, overflow:'hidden', background:'#f3f4f6' }}>
              {r.logo_url && <img src={r.logo_url} alt={r.nick || r.name || 'tercero'} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
            </div>
            <div style={{ flex:'1 1 auto' }}>
              <a href={`/partners/thirds/${r.id}`} style={{ fontWeight:600 }}>{r.nick || r.name || 'Sin nombre'}</a>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
