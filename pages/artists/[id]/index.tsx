// pages/artists/[id]/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../../lib/supabaseClient';
import Layout from '../../../components/Layout';
import Button from '../../../components/Button';
import ContractsBlock from '../../../components/ContractsBlock';
import PartySearchSelect from '../../../components/PartySearchSelect';


type Artist = {
  id: string;
  stage_name: string;
  contract_type: 'General'|'Booking';
  is_group: boolean;
  photo_url: string | null;
  full_name: string | null;
  dni: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  tax_type: 'particular'|'empresa'|null;
  tax_name: string | null;
  tax_id: string | null;
  tax_address: string | null;
  iban: string | null;
  is_archived?: boolean | null;
};

type Member = {
  id: string; full_name: string; dni: string | null; birth_date: string | null;
  email: string | null; phone: string | null;
  tax_type: 'particular'|'empresa'; tax_name: string | null; tax_id: string | null;
  tax_address: string | null; iban: string | null; share_pct: number;
};

type Econ = {
  category: string; artist_pct: number; office_pct: number;
  artist_base: 'gross'|'net'; office_base: 'gross'|'net';
  office_exempt_type: 'amount'|'percent'; office_exempt_value: number;
  brands_mode?: 'office_only'|'split'|null;
};

type Third = {
  id: string; artist_id: string|null; kind: 'third'|'provider';
  nick: string|null; name: string|null; email: string|null; phone: string|null;
  logo_url: string|null; is_active: boolean; unlinked?: boolean|null; unlinked_at?: string|null;
  unlinked_from_artist_id?: string|null;
};
type ThirdEcon = {
  category:string; third_pct:number; third_base:'gross'|'net';
  base_scope:'total'|'office'|'artist'; third_exempt_type:'amount'|'percent'; third_exempt_value:number;
};

const GENERAL_ORDER = [
  'Conciertos a caché','Conciertos a empresa','Acciones con marcas',
  'Merchandising','Editorial','Royalties Discográficos','Otras acciones'
];

export default function ArtistShow() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [artist, setArtist] = useState<Artist|null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [econ, setEcon] = useState<Econ[]>([]);
  const [thirds, setThirds] = useState<(Third & { econ: ThirdEcon[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string| null>(null);

  async function loadAll() {
    if (!id) return;
    setLoading(true); setErr(null);
    try {
      const { data: a } = await supabase.from('artists').select('*').eq('id', id).single();
      setArtist(a as any);

      const { data: m } = await supabase.from('artist_members').select('*').eq('artist_id', id);
      const uniq = new Map<string, any>();
      (m||[]).forEach((r:any)=>{ const k = `${r.full_name||''}::${r.dni||''}`; if(!uniq.has(k)) uniq.set(k,r); });
      setMembers(Array.from(uniq.values()) as any);

      const { data: e } = await supabase.from('artist_economics').select('*').eq('artist_id', id);
      const byCat = new Map<string, any>();
      (e||[]).forEach((r:any)=>byCat.set(r.category, r));
      const filtered = Array.from(byCat.values()).filter((r:any)=>{
        if (r.category==='Conciertos a caché') return Number(r.office_pct||0) > 0;
        if (r.category==='Royalties Discográficos') return Number(r.artist_pct||0) > 0;
        return Number(r.artist_pct||0) > 0 || Number(r.office_pct||0) > 0;
      }).sort((a,b)=> GENERAL_ORDER.indexOf(a.category)-GENERAL_ORDER.indexOf(b.category));
      setEcon(filtered as any);

      const { data: t } = await supabase
        .from('third_parties')
        .select('*, third_party_economics(*)')
        .eq('artist_id', id)
        .eq('is_deleted', false)
        .eq('kind','third')
        .order('nick',{ascending:true});
      setThirds(((t||[]) as any).map((row:any)=>({
        id: row.id, artist_id: row.artist_id, kind: row.kind, nick: row.nick, name: row.name,
        email: row.email, phone: row.phone, logo_url: row.logo_url, is_active: row.is_active!==false,
        unlinked: row.unlinked, unlinked_at: row.unlinked_at, unlinked_from_artist_id: row.unlinked_from_artist_id,
        econ: (row.third_party_economics||[]).filter((r:any)=>Number(r.third_pct||0) > 0)
      })));
    } catch (e:any) {
      setErr(e.message || 'Error cargando artista');
    } finally {
      setLoading(false);
    }
  }
  useEffect(()=>{ loadAll(); }, [id]);

  async function setArchived(value: boolean) {
    if (!artist) return;
    const { error } = await supabase.from('artists').update({ is_archived: value }).eq('id', artist.id);
    if (error) { alert('No se pudo actualizar: ' + error.message); return; }
    await loadAll();
  }

  async function hardDelete() {
    if (!artist) return;
    const sure = prompt('Escribe ELIMINAR para borrar definitivamente este artista');
    if (sure !== 'ELIMINAR') return;
    try {
      // contratos
      await supabase.from('artist_contracts').delete().eq('artist_id', artist.id);

      // terceros -> borrar contratos/econ y desvincular
      const { data: tps } = await supabase.from('third_parties').select('id').eq('artist_id', artist.id);
      for (const tp of (tps||[])) {
        await supabase.from('third_party_contracts').delete().eq('third_party_id', tp.id);
        await supabase.from('third_party_economics').delete().eq('third_party_id', tp.id);
      }
      await supabase.from('third_parties').delete().eq('artist_id', artist.id);

      await supabase.from('artist_member_splits').delete().eq('artist_id', artist.id);
      await supabase.from('artist_members').delete().eq('artist_id', artist.id);
      await supabase.from('artist_economics').delete().eq('artist_id', artist.id);

      const { error } = await supabase.from('artists').delete().eq('id', artist.id);
      if (error) throw error;

      const { data: still } = await supabase.from('artists').select('id').eq('id', artist.id).maybeSingle();
      if (still) { alert('El artista sigue existiendo (probable FK o RLS).'); return; }

      window.location.href = '/artists/archived';
    } catch (e:any) {
      alert('No se pudo borrar: ' + (e.message || e));
    }
  }

  async function unlinkThird(thirdId: string) {
    if (!artist) return;
    const ok = confirm('¿Desvincular este tercero del artista? Se conservará el histórico en su ficha.');
    if (!ok) return;
    const { error } = await supabase
      .from('third_parties')
      .update({
        artist_id: null,
        unlinked: true,
        unlinked_at: new Date().toISOString(),
        unlinked_from_artist_id: artist.id
      })
      .eq('id', thirdId);
    if (error) { alert('No se pudo desvincular: ' + error.message); return; }
    await loadAll();
  }

  // Añadir tercero: usar PartySearchSelect y vincular
  async function linkThird(tp: {id:string}) {
    if (!artist) return;
    const { error } = await supabase
      .from('third_parties')
      .update({ artist_id: artist.id, unlinked: false, unlinked_at: null, unlinked_from_artist_id: null })
      .eq('id', tp.id);
    if (error) return alert(error.message);
    await loadAll();
  }

  if (loading) return <Layout><div className="module">Cargando…</div></Layout>;
  if (err || !artist) return <Layout><div className="module" style={{color:'#d42842'}}>Error: {err || 'No encontrado'}</div></Layout>;

  return (
    <Layout>
      {/* Cabecera */}
      <div className="module" style={{display:'flex', alignItems:'center', gap:16, justifyContent:'space-between'}}>
        <div style={{display:'flex', alignItems:'center', gap:16}}>
          <div style={{ width: 96, height: 96, borderRadius: 16, overflow: 'hidden', background: '#f3f4f6' }}>
            {artist.photo_url && (
              <img src={artist.photo_url} alt={artist.stage_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            )}
          </div>
          <div>
            <h1 style={{ margin: 0 }}>{artist.stage_name}</h1>
            <div style={{ color: '#6b7280', marginTop: 4 }}>
              Contrato: <strong>{artist.contract_type}</strong> &nbsp;·&nbsp; {artist.is_group ? 'Grupo' : 'Solista'}
            </div>
            {artist.is_archived ? (
              <div style={{ color:'#b91c1c', fontSize:12, marginTop:4 }}>Archivado</div>
            ) : null}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <Link href={`/artists/${artist.id}/edit`}><Button tone="neutral">Editar</Button></Link>
          {artist.is_archived ? (
            <>
              <Button onClick={()=>setArchived(false)}>Recuperar</Button>
              <Button tone="danger" onClick={hardDelete}>Borrar</Button>
            </>
          ) : (
            <Button tone="danger" onClick={()=>setArchived(true)}>Archivar</Button>
          )}
        </div>
      </div>

      {/* Datos personales */}
      <div className="module">
        <h2>Datos personales</h2>
        {!artist.is_group ? (
          <div className="row">
            {artist.full_name ? <div style={{ flex:'1 1 260px' }}><strong>Nombre completo</strong><div>{artist.full_name}</div></div> : null}
            {artist.dni ? <div style={{ flex:'0 0 160px' }}><strong>DNI</strong><div>{artist.dni}</div></div> : null}
            {artist.birth_date ? <div style={{ flex:'0 0 180px' }}><strong>Nacimiento</strong><div>{artist.birth_date}</div></div> : null}
            {artist.email ? <div style={{ flex:'1 1 260px' }}><strong>Email</strong><div>{artist.email}</div></div> : null}
            {artist.phone ? <div style={{ flex:'0 0 180px' }}><strong>Teléfono</strong><div>{artist.phone}</div></div> : null}
          </div>
        ) : (
          <MembersList artistId={artist.id}/>
        )}
      </div>

      {/* Datos fiscales */}
      <div className="module">
        <h2>Datos fiscales</h2>
        {!artist.is_group ? (
          <div className="row">
            {artist.tax_type ? <div style={{ flex:'0 0 180px' }}><strong>Tipo</strong><div>{artist.tax_type}</div></div> : null}
            {(artist.tax_name || artist.full_name) ? <div style={{ flex:'1 1 260px' }}><strong>Nombre fiscal / Empresa</strong><div>{artist.tax_name || artist.full_name}</div></div> : null}
            {(artist.tax_id || artist.dni) ? <div style={{ flex:'0 0 200px' }}><strong>NIF/CIF</strong><div>{artist.tax_id || artist.dni}</div></div> : null}
            {artist.tax_address ? <div style={{ flex:'1 1 320px' }}><strong>Domicilio fiscal</strong><div>{artist.tax_address}</div></div> : null}
            {artist.iban ? <div style={{ flex:'1 1 280px' }}><strong>IBAN</strong><div>{artist.iban}</div></div> : null}
          </div>
        ) : (
          <MembersTaxList artistId={artist.id}/>
        )}
      </div>

      {/* Contratos */}
      <div className="module">
        <ContractsBlock kind="artist" ownerId={artist.id} />
      </div>

      {/* Condiciones económicas */}
      <div className="module">
        <h2>Condiciones económicas</h2>
        {econ.length===0 ? <small>No hay condiciones configuradas.</small> : (
          <>
            {econ.map((r) => (
              <div key={r.category} className="row" style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, marginTop: 10 }}>
                <div style={{ flex:'1 1 220px' }}>
                  <div className="badge">{r.category}</div>
                </div>

                {Number(r.office_pct||0) > 0 && (
                  <>
                    <div style={{ flex:'0 0 120px' }}><strong>% Oficina</strong><div>{r.office_pct}%</div></div>
                    <div style={{ flex:'0 0 120px' }}><strong>Base Oficina</strong><div>{r.office_base === 'net' ? 'Neto' : 'Bruto'}</div></div>
                    {Number(r.office_exempt_value||0) > 0 && (
                      <div style={{ flex:'0 0 200px' }}><strong>Exento Oficina</strong>
                        <div>{r.office_exempt_type === 'percent' ? `${r.office_exempt_value}%` : `${r.office_exempt_value.toLocaleString()} €`}</div>
                      </div>
                    )}
                  </>
                )}
                {r.category !== 'Conciertos a caché' && Number(r.artist_pct||0) > 0 && (
                  <>
                    <div style={{ flex:'0 0 120px' }}><strong>% Artista</strong><div>{r.artist_pct}%</div></div>
                    <div style={{ flex:'0 0 120px' }}><strong>Base Artista</strong><div>{r.artist_base === 'net' ? 'Neto' : 'Bruto'}</div></div>
                  </>
                )}
                {r.category === 'Acciones con marcas' && r.brands_mode && (
                  <div style={{ flex:'0 0 220px' }}><strong>Modo</strong>
                    <div>{r.brands_mode === 'office_only' ? 'Comisión de oficina' : 'Reparto porcentajes'}</div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Terceros vinculados */}
      <div className="module">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <h2 style={{margin:0}}>Terceros vinculados</h2>
        </div>

        {/* Buscar/crear y vincular */}
        <PartySearchSelect mode="third" onPicked={linkThird} />

        {thirds.length === 0 ? <small>No hay terceros vinculados.</small> : null}

        {thirds.map((t)=>(
          <div key={t.id} className="card">
            <div className="row" style={{ alignItems:'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, overflow:'hidden', background:'#f3f4f6' }}>
                {t.logo_url && <img src={t.logo_url} alt={t.nick || t.name || 'tercero'} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
              </div>
              <div style={{ flex:'1 1 auto' }}>
                <Link href={`/partners/thirds/${t.id}`} style={{ fontWeight: 600 }}>
                  {t.nick || t.name || 'Sin nombre'}
                </Link>
                <div style={{ color:'#6b7280', fontSize:12 }}>
                  {t.email || '—'} · {t.phone || '—'}
                </div>
              </div>
              <div style={{display:'flex', gap:8}}>
                <Link href={`/partners/thirds/${t.id}`}><Button tone="neutral">Editar</Button></Link>
                <Button tone="danger" onClick={()=>unlinkThird(t.id)}>Desvincular</Button>
              </div>
            </div>

            {t.econ.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {t.econ.filter(e=>Number(e.third_pct||0) > 0).map((e, idx)=>(
                  <div key={idx} className="row" style={{ borderTop:'1px solid #e5e7eb', paddingTop:8 }}>
                    <div style={{ flex:'1 1 220px' }}><div className="badge">{e.category}</div></div>
                    <div style={{ flex:'0 0 120px' }}><strong>%</strong><div>{e.third_pct}%</div></div>
                    <div style={{ flex:'0 0 120px' }}><strong>Base</strong><div>{e.third_base === 'net' ? 'Neto' : 'Bruto'}</div></div>
                    <div style={{ flex:'0 0 200px' }}><strong>Ámbito</strong><div>{e.base_scope === 'office' ? 'Oficina' : e.base_scope === 'artist' ? 'Artista' : 'Total'}</div></div>
                    {Number(e.third_exempt_value||0) > 0 && (
                      <div style={{ flex:'0 0 200px' }}>
                        <strong>Exento</strong>
                        <div>{e.third_exempt_type === 'percent' ? `${e.third_exempt_value}%` : `${e.third_exempt_value.toLocaleString()} €`}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <h3 style={{ fontSize: 14, margin: '12px 0 6px' }}>Contratos del tercero</h3>
              <ContractsBlock kind="third" ownerId={t.id} />
            </div>
          </div>
        ))}
      </div>
    </Layout>
  );
}

function MembersList({ artistId }:{artistId:string}) {
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(()=>{ (async()=>{
    const { data } = await supabase.from('artist_members').select('*').eq('artist_id', artistId);
    setMembers(data||[]);
  })(); }, [artistId]);
  if (members.length===0) return <small>No hay miembros.</small>;
  return (
    <>
      {members.map(m=>(
        <div key={m.id} className="card">
          <div className="row">
            {m.full_name ? <div style={{flex:'1 1 260px'}}><strong>Nombre completo</strong><div>{m.full_name}</div></div> : null}
            {m.dni ? <div style={{flex:'0 0 160px'}}><strong>DNI</strong><div>{m.dni}</div></div> : null}
            {m.birth_date ? <div style={{flex:'0 0 180px'}}><strong>Nacimiento</strong><div>{m.birth_date}</div></div> : null}
            {m.email ? <div style={{flex:'1 1 260px'}}><strong>Email</strong><div>{m.email}</div></div> : null}
            {m.phone ? <div style={{flex:'0 0 180px'}}><strong>Teléfono</strong><div>{m.phone}</div></div> : null}
          </div>
        </div>
      ))}
    </>
  );
}

function MembersTaxList({ artistId }:{artistId:string}) {
  const [members, setMembers] = useState<Member[]>([]);
  useEffect(()=>{ (async()=>{
    const { data } = await supabase.from('artist_members').select('*').eq('artist_id', artistId);
    setMembers(data||[]);
  })(); }, [artistId]);
  if (members.length===0) return <small>No hay miembros.</small>;
  return (
    <>
      {members.map(m=>(
        <div key={m.id} className="card">
          <div className="row">
            {m.tax_type ? <div style={{flex:'0 0 180px'}}><strong>Tipo</strong><div>{m.tax_type}</div></div> : null}
            {(m.tax_name || m.full_name) ? <div style={{flex:'1 1 260px'}}><strong>Nombre fiscal / Empresa</strong><div>{m.tax_type==='particular' ? (m.full_name || '—') : (m.tax_name || '—')}</div></div> : null}
            {(m.tax_id || m.dni) ? <div style={{flex:'0 0 200px'}}><strong>NIF/CIF</strong><div>{m.tax_type==='particular' ? (m.dni || '—') : (m.tax_id || '—')}</div></div> : null}
            {m.tax_address ? <div style={{flex:'1 1 320px'}}><strong>Domicilio fiscal</strong><div>{m.tax_address}</div></div> : null}
            {m.iban ? <div style={{flex:'1 1 280px'}}><strong>IBAN</strong><div>{m.iban}</div></div> : null}
          </div>
        </div>
      ))}
    </>
  );
}
