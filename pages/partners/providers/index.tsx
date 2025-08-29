import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Layout from '../../../components/Layout';
import Button from '../../../components/Button';

type Row = {
  id: string;
  nick: string|null;
  name: string|null;
  logo_url: string|null;
  is_active: boolean;
};

export default function ProvidersIndex() {
  const [list, setList] = useState<Row[]>([]);
  const [q, setQ] = useState('');

  async function load() {
    const { data, error } = await supabase
      .from('third_parties')
      .select('id, nick, name, logo_url, is_active, kind')
      .order('nick', { ascending: true });
    if (error) { alert(error.message); return; }
    const rows = (data || []).filter((r:any)=> r.kind === 'provider');
    setList(rows as any);
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
      <h1>Proveedores</h1>

      <div className="module">
        <div className="row" style={{ alignItems:'center' }}>
          <div style={{ flex:'1 1 420px' }}>
            <input placeholder="Buscar por nick o nombre…" value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div style={{ marginLeft:'auto' }}>
            <Button as="a" href="/partners/providers/new">+ Añadir proveedor</Button>
          </div>
        </div>
      </div>

      <div className="module">
        {filtered.length === 0 ? <small>No hay proveedores.</small> : null}
        {filtered.map(r=>(
          <div key={r.id} className="row" style={{ borderTop:'1px solid #e5e7eb', padding:'8px 0', alignItems:'center' }}>
            <div style={{ width:48, height:48, borderRadius:12, overflow:'hidden', background:'#f3f4f6' }}>
              {r.logo_url && <img src={r.logo_url} alt={r.nick || r.name || 'proveedor'} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
            </div>
            <div style={{ flex:'1 1 auto' }}>
              <a href={`/partners/providers/${r.id}`} style={{ fontWeight:600 }}>{r.nick || r.name || 'Sin nombre'}</a>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}
