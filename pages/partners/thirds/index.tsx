// pages/partners/thirds/index.tsx
import { useEffect, useMemo, useState } from 'react';
import Layout from '../../../components/Layout';
import { supabase } from '../../../lib/supabaseClient';
import { matches } from '../../../lib/search';
import Link from 'next/link';
import Button from '../../../components/Button';

type Row = {
  id: string;
  kind: 'third'|'provider';
  nick: string | null;
  name: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

export default function ThirdsIndex() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');

  async function load() {
    const { data } = await supabase
      .from('third_parties')
      .select('id, kind, nick, name, logo_url, is_active')
      .eq('kind','third')
      .neq('is_active', false)              -- no mostrar eliminados
      .order('created_at', { ascending:false });
    setRows((data||[]) as any);
  }
  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(()=> rows.filter(
    r => matches(r.nick, q) || matches(r.name, q)
  ), [rows, q]);

  return (
    <Layout>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <input placeholder="Buscar tercero…" value={q} onChange={e=>setQ(e.target.value)} />
        <div>
          {/* aquí no se crean terceros “sueltos”; se crean desde la ficha de artista */}
        </div>
      </div>

      <div className="module">
        <h2 style={{marginTop:0}}>Terceros</h2>
        <div style={{display:'grid', gap:12}}>
          {filtered.map(t=>(
            <Link key={t.id} href={`/partners/thirds/${t.id}`} className="card" style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:56,height:56,borderRadius:12,overflow:'hidden',background:'#f3f4f6'}}>
                {t.logo_url ? <img src={t.logo_url} alt={t.nick||t.name||''} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : null}
              </div>
              <div style={{fontWeight:600}}>{t.nick || t.name || 'Sin nombre'}</div>
            </Link>
          ))}
          {filtered.length===0 ? <small>No hay resultados.</small> : null}
        </div>
      </div>
    </Layout>
  );
}
