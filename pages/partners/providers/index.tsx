// pages/partners/providers/index.tsx
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import Button from '../../../components/Button';
import { supabase } from '../../../lib/supabaseClient';

type ProviderRow = {
  id: string;
  kind: 'provider' | 'third';
  nick: string | null;
  name: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

export default function ProvidersIndex() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    // 👇 OJO: toda la cadena dentro de los paréntesis para que el await
    // aplique a la consulta completa (evitamos el error de ASI).
    const { data, error } = await (
      supabase
        .from('third_parties')
        .select('id, kind, nick, name, logo_url, is_active')
        .eq('kind', 'provider')
        .order('nick', { ascending: true })
    );
    if (error) {
      setErr(error.message);
    } else {
      setRows((data || []) as ProviderRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Búsqueda local sin tildes (por si no quieres hacer roundtrip al servidor).
  function norm(s: string) {
    return s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  }

  const filtered = useMemo(() => {
    const nq = norm(q);
    if (!nq) return rows;
    return rows.filter(r => {
      const a = norm(r.nick || '');
      const b = norm(r.name || '');
      return a.includes(nq) || b.includes(nq);
    });
  }, [q, rows]);

  return (
    <Layout>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <h1 style={{margin:0}}>Proveedores</h1>
        <Button as="a" href="/partners/providers/new">+ Añadir proveedor</Button>
      </div>

      <input
        placeholder="Buscar proveedor…"
        value={q}
        onChange={e => setQ(e.target.value)}
        className="input"
        style={{width:'100%', marginBottom:12}}
      />

      {loading && <div className="module">Cargando…</div>}
      {err && <div className="module" style={{color:'#d42842'}}>Error: {err}</div>}

      {!loading && !err && (
        <div className="module">
          {filtered.length === 0 ? (
            <small>No hay proveedores.</small>
          ) : (
            <ul style={{listStyle:'none', padding:0, margin:0}}>
              {filtered.map(p => (
                <li key={p.id} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderTop:'1px solid #e5e7eb'}}>
                  <div style={{width:48, height:48, borderRadius:10, overflow:'hidden', background:'#f3f4f6', flex:'0 0 48px'}}>
                    {p.logo_url && <img src={p.logo_url} alt={p.nick || p.name || 'Proveedor'} style={{width:'100%', height:'100%', objectFit:'cover'}}/>}
                  </div>
                  <div style={{flex:'1 1 auto'}}>
                    <Link href={`/partners/providers/${p.id}`} style={{fontWeight:600}}>
                      {p.nick || p.name || '(Sin nombre)'}
                    </Link>
                    {p.is_active === false && (
                      <span style={{marginLeft:8, fontSize:12, color:'#6b7280'}}>(inactivo)</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Layout>
  );
}
