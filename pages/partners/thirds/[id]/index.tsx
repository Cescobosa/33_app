import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../../lib/supabaseClient';
import Layout from '../../../../components/Layout';
import ContractsBlock from '../../../../components/ContractsBlock';

type Third = {
  id: string;
  nick: string|null;
  name: string|null;
  email: string|null;
  phone: string|null;
  logo_url: string|null;
  is_active: boolean;
};

type Link = {
  artist_id: string;
  stage_name: string;
};

type Econ = {
  category: string;
  third_pct: number;
  third_base: 'gross'|'net';
  base_scope: 'total'|'office'|'artist';
  third_exempt_type: 'amount'|'percent';
  third_exempt_value: number;
};

export default function ThirdShow() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [third, setThird] = useState<Third|null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [econ, setEcon] = useState<Econ[]>([]);

  async function load() {
    const { data: t } = await supabase.from('third_parties').select('*').eq('id', id).single();
    setThird(t as any);

    // artistas vinculados (simple)
    const { data: a } = await supabase
      .from('artists')
      .select('id, stage_name')
      .in('id',
        (await supabase.from('third_parties').select('artist_id').eq('id', id)).data?.map((x:any)=>x.artist_id) || []
      );
    setLinks((a||[]) as any);

    const { data: e } = await supabase.from('third_party_economics').select('*').eq('third_party_id', id);
    setEcon((e||[]).filter((r:any)=>Number(r.third_pct||0) > 0) as any);
  }

  useEffect(()=>{ if (id) load(); }, [id]);

  if (!third) return <Layout><div className="module">Cargando…</div></Layout>;

  return (
    <Layout>
      {/* Cabecera */}
      <div className="module" style={{ display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ width:96, height:96, borderRadius:16, overflow:'hidden', background:'#f3f4f6' }}>
          {third.logo_url && <img src={third.logo_url} alt={third.nick || third.name || 'tercero'} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
        </div>
        <div>
          <h1 style={{ margin:0 }}>{third.nick || third.name || 'Sin nombre'}</h1>
          <div style={{ color:'#6b7280', marginTop:4 }}>{third.email || '—'} · {third.phone || '—'}</div>
        </div>
      </div>

      {/* Vinculaciones */}
      <div className="module">
        <h2>Vinculaciones</h2>
        {links.length === 0 ? <small>No hay artistas vinculados.</small> : (
          <div className="row" style={{ gap:12, flexWrap:'wrap' }}>
            {links.map((l)=>(<a key={l.artist_id} className="btn" href={`/artists/${l.artist_id}`}>{l.stage_name}</a>))}
          </div>
        )}
      </div>

      {/* Condiciones económicas (sólo las que tienen % */}
      <div className="module">
        <h2>Condiciones económicas</h2>
        {econ.length === 0 ? <small>No hay condiciones con porcentaje.</small> : econ.map((e, i)=>(
          <div key={i} className="row" style={{ borderTop:'1px solid #e5e7eb', paddingTop:8 }}>
            <div style={{ flex:'1 1 220px' }}><div className="badge">{e.category}</div></div>
            <div style={{ flex:'0 0 120px' }}><strong>%</strong><div>{e.third_pct}%</div></div>
            <div style={{ flex:'0 0 120px' }}><strong>Base</strong><div>{e.third_base==='net'?'Neto':'Bruto'}</div></div>
            <div style={{ flex:'0 0 200px' }}><strong>Ámbito</strong><div>{e.base_scope==='office'?'Oficina':e.base_scope==='artist'?'Artista':'Total'}</div></div>
            {Number(e.third_exempt_value||0) > 0 && (
              <div style={{ flex:'0 0 200px' }}><strong>Exento</strong>
                <div>{e.third_exempt_type==='percent' ? `${e.third_exempt_value}%` : `${e.third_exempt_value.toLocaleString()} €`}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Contratos */}
      <div className="module">
        <h2>Contratos</h2>
        <ContractsBlock kind="third" ownerId={third.id} />
      </div>
    </Layout>
  );
}
