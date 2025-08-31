// pages/partners/thirds/index.tsx
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Layout from '../../../components/Layout';
import Button from '../../../components/Button';
import { supabase } from '../../../lib/supabaseClient';

type ThirdRow = {
  id: string;
  kind: 'third' | 'provider';
  nick: string | null;
  name: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

export default function ThirdsIndex() {
  const [rows, setRows] = useState<ThirdRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);

    // ¡IMPORTANTE!: No dejes un salto de línea después de `await supabase`
    const { data, error } = await supabase
      .from('third_parties')
      .select('id, kind, nick, name, logo_url, is_active')
      .eq('kind', 'third')
      .order('nick', { ascending: true });

    if (error) setErr(error.message);
    else setRows((data || []) as ThirdRow[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Búsqueda sin tildes, compatible con ES5 (mismo helper que en providers)
  function norm(s: string) {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
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
        <h1 style={{margin:0}}>Terceros</h1>
        <Button as="a" href="/partners/thirds/new">+ Añadir tercero</Button>
      </div>

      <input
        placeholder="Buscar tercero…"
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
            <small>No hay terceros.</small>
          ) : (
            <ul style={{listStyle:'none', padding:0, margin:0}}>
              {filtered.map(t => (
                <li key={t.id} style={{display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderTop:'1px solid #e5e7eb'}}>
                  <div style={{width:48, height:48, borderRadius:10, overflow:'hidden', background:'#f3f4f6', flex:'0 0 48px'}}>
                    {t.logo_url && <img src={t.logo_url} alt={t.nick || t.name || 'Tercero'} style={{width:'100%', height:'100%', objectFit:'cover'}}/>}
                  </div>
                  <div style={{flex:'1 1 auto'}}>
                    <Link href={`/partners/thirds/${t.id}`} style={{fontWeight:600}}>
                      {t.nick || t.name || '(Sin nombre)'}
                    </Link>
                    {t.is_active === false && (
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
