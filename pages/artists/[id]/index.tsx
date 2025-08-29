import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../lib/supabaseClient';
import Layout from '../../../components/Layout';
import Button from '../../../components/Button';
import ContractsBlock from '../../../components/ContractsBlock';

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
};

type Member = {
  id: string;
  full_name: string;
  dni: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  tax_type: 'particular'|'empresa';
  tax_name: string | null;
  tax_id: string | null;
  tax_address: string | null;
  iban: string | null;
  share_pct: number;
};

type Econ = {
  category: string;
  artist_pct: number;
  office_pct: number;
  artist_base: 'gross'|'net';
  office_base: 'gross'|'net';
  office_exempt_type: 'amount'|'percent';
  office_exempt_value: number;
  brands_mode?: 'office_only'|'split'|null;
};

type Third = {
  id: string;
  artist_id: string;
  kind: 'third'|'provider';
  nick: string|null;
  name: string|null;
  email: string|null;
  phone: string|null;
  logo_url: string|null;
  is_active: boolean;
};

type ThirdEcon = {
  category: string;
  third_pct: number;
  third_base: 'gross'|'net';
  base_scope: 'total'|'office'|'artist';
  third_exempt_type: 'amount'|'percent';
  third_exempt_value: number;
};

const GENERAL_ORDER = [
  'Conciertos a caché',
  'Conciertos a empresa',
  'Acciones con marcas',
  'Merchandising',
  'Editorial',
  'Royalties Discográficos',
  'Otras acciones'
];

export default function ArtistShow() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [artist, setArtist] = useState<Artist|null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [econ, setEcon] = useState<Econ[]>([]);
  const [thirds, setThirds] = useState<(Third & { econ: ThirdEcon[] })[]>([]);

  // alta inline de tercero (sin salir de la ficha)
  const [creatingThird, setCreatingThird] = useState(false);
  const [newThird, setNewThird] = useState({
    nick: '', name: '', email: '', phone: '', tax_id: ''
  });

  async function loadAll() {
    if (!id) return;
    const { data: a } = await supabase.from('artists').select('*').eq('id', id).single();
    setArtist(a as any);

    // miembros únicos (si el backend duplicó por algún motivo, los deduplicamos)
    const { data: m } = await supabase
      .from('artist_members')
      .select('*')
      .eq('artist_id', id);
    const uniqueMap = new Map<string, any>();
    (m||[]).forEach((row:any) => {
      const key = `${row.full_name ?? ''}::${row.dni ?? ''}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, row);
    });
    setMembers(Array.from(uniqueMap.values()) as any);

    // económicas SIN mezclar con plantillas -> sólo lo guardado en BD
    const { data: e } = await supabase
      .from('artist_economics')
      .select('*')
      .eq('artist_id', id);
    // Dedup por categoría (si había repetidas)
    const byCat = new Map<string, Econ>();
    (e||[]).forEach((row:any)=> { byCat.set(row.category, row); });
    const filtered = Array.from(byCat.values()).filter((r:any)=>{
      if (r.category === 'Conciertos a caché') return Number(r.office_pct||0) > 0;
      if (r.category === 'Royalties Discográficos') return Number(r.artist_pct||0) > 0;
      // resto: mostrar si hay algún % > 0
      return Number(r.artist_pct||0) > 0 || Number(r.office_pct||0) > 0;
    }).sort((a,b)=> GENERAL_ORDER.indexOf(a.category) - GENERAL_ORDER.indexOf(b.category));
    setEcon(filtered as any);

    // terceros (sólo kind='third') + económicas del tercero
    const { data: t } = await supabase
      .from('third_parties')
      .select('*, third_party_economics(*)')
      .eq('artist_id', id)
      .eq('kind','third')
      .order('nick', { ascending: true });
    setThirds(((t||[]) as any).map((row:any)=>({
      id: row.id,
      artist_id: row.artist_id,
      kind: row.kind,
      nick: row.nick,
      name: row.name,
      email: row.email,
      phone: row.phone,
      logo_url: row.logo_url,
      is_active: row.is_active !== false,
      econ: (row.third_party_economics||[]).filter((r:any)=> Number(r.third_pct||0) > 0)
    })));
  }

  useEffect(()=>{ loadAll(); }, [id]);

  async function createThirdInline() {
    if (!newThird.nick.trim() && !newThird.name.trim()) {
      return alert('Pon un Nick o Nombre/Compañía.');
    }
    try {
      const { data: tp, error } = await supabase.from('third_parties')
        .insert({
          artist_id: id,
          kind: 'third',
          nick: newThird.nick || null,
          name: newThird.name || null,
          email: newThird.email || null,
          phone: newThird.phone || null,
          tax_id: newThird.tax_id || null,
          is_active: true
        })
        .select('*')
        .single();
      if (error) throw error;

      // Econ por defecto: según contrato del artista
      if (artist?.contract_type === 'Booking') {
        await supabase.from('third_party_economics').insert({
          third_party_id: tp.id,
          category: 'Booking',
          third_pct: 0,
          third_base: 'gross',
          base_scope: 'total',
          third_exempt_type: 'amount',
          third_exempt_value: 0
        });
      } else {
        for (const cat of GENERAL_ORDER) {
          await supabase.from('third_party_economics').insert({
            third_party_id: tp.id,
            category: cat,
            third_pct: 0,
            third_base: 'gross',
            base_scope: 'total',
            third_exempt_type: 'amount',
            third_exempt_value: 0
          });
        }
      }

      setCreatingThird(false);
      setNewThird({ nick:'', name:'', email:'', phone:'', tax_id:'' });
      await loadAll();
    } catch (e:any) {
      alert(e.message || 'Error creando tercero');
    }
  }

  if (!artist) return <Layout><div className="module">Cargando…</div></Layout>;

  return (
    <Layout>
      {/* Cabecera simple: foto + nombre artístico */}
      <div className="module" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 96, height: 96, borderRadius: 16, overflow: 'hidden', background: '#f3f4f6' }}>
          {artist.photo_url && <img src={artist.photo_url} alt={artist.stage_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>}
        </div>
        <div>
          <h1 style={{ margin: 0 }}>{artist.stage_name}</h1>
          <div style={{ color: '#6b7280', marginTop: 4 }}>
            Contrato: <strong>{artist.contract_type}</strong> &nbsp;·&nbsp; {artist.is_group ? 'Grupo' : 'Solista'}
          </div>
        </div>
      </div>

      {/* Datos personales */}
      <div className="module">
        <h2>Datos personales</h2>

        {!artist.is_group ? (
          <>
            <div className="row">
              <div style={{ flex:'1 1 260px' }}><strong>Nombre completo</strong><div>{artist.full_name || '—'}</div></div>
              <div style={{ flex:'0 0 160px' }}><strong>DNI</strong><div>{artist.dni || '—'}</div></div>
              <div style={{ flex:'0 0 180px' }}><strong>Nacimiento</strong><div>{artist.birth_date || '—'}</div></div>
              <div style={{ flex:'1 1 260px' }}><strong>Email</strong><div>{artist.email || '—'}</div></div>
              <div style={{ flex:'0 0 180px' }}><strong>Teléfono</strong><div>{artist.phone || '—'}</div></div>
            </div>
          </>
        ) : (
          <>
            {members.length === 0 ? <small>No hay miembros.</small> : null}
            {members.map((m)=>(
              <div key={m.id} className="card">
                <div className="row">
                  <div style={{ flex:'1 1 260px' }}><strong>Nombre completo</strong><div>{m.full_name || '—'}</div></div>
                  <div style={{ flex:'0 0 160px' }}><strong>DNI</strong><div>{m.dni || '—'}</div></div>
                  <div style={{ flex:'0 0 180px' }}><strong>Nacimiento</strong><div>{m.birth_date || '—'}</div></div>
                  <div style={{ flex:'1 1 260px' }}><strong>Email</strong><div>{m.email || '—'}</div></div>
                  <div style={{ flex:'0 0 180px' }}><strong>Teléfono</strong><div>{m.phone || '—'}</div></div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Datos fiscales (siempre visible; en grupo: subtarjetas por miembro) */}
      <div className="module">
        <h2>Datos fiscales</h2>
        {!artist.is_group ? (
          <div className="row">
            <div style={{ flex:'0 0 180px' }}><strong>Tipo</strong><div>{artist.tax_type || '—'}</div></div>
            <div style={{ flex:'1 1 260px' }}><strong>Nombre fiscal / Empresa</strong><div>{artist.tax_name || (artist.tax_type==='particular' ? (artist.full_name||'—') : '—')}</div></div>
            <div style={{ flex:'0 0 200px' }}><strong>NIF/CIF</strong><div>{artist.tax_id || (artist.tax_type==='particular' ? (artist.dni||'—') : '—')}</div></div>
            <div style={{ flex:'1 1 320px' }}><strong>Domicilio fiscal</strong><div>{artist.tax_address || '—'}</div></div>
            <div style={{ flex:'1 1 280px' }}><strong>IBAN</strong><div>{artist.iban || '—'}</div></div>
          </div>
        ) : (
          <>
            {members.length === 0 ? <small>No hay miembros.</small> : null}
            {members.map((m)=>(
              <div key={m.id} className="card">
                <div className="row">
                  <div style={{ flex:'0 0 180px' }}><strong>Tipo</strong><div>{m.tax_type || '—'}</div></div>
                  <div style={{ flex:'1 1 260px' }}><strong>Nombre fiscal / Empresa</strong><div>{m.tax_type==='particular' ? (m.full_name || '—') : (m.tax_name || '—')}</div></div>
                  <div style={{ flex:'0 0 200px' }}><strong>NIF/CIF</strong><div>{m.tax_type==='particular' ? (m.dni || '—') : (m.tax_id || '—')}</div></div>
                  <div style={{ flex:'1 1 320px' }}><strong>Domicilio fiscal</strong><div>{m.tax_address || '—'}</div></div>
                  <div style={{ flex:'1 1 280px' }}><strong>IBAN</strong><div>{m.iban || '—'}</div></div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Contratos (múltiples) */}
      <div className="module">
        <h2>Contratos</h2>
        <ContractsBlock kind="artist" ownerId={artist.id} />
      </div>

      {/* Condiciones económicas */}
      <div className="module">
        <h2>Condiciones económicas</h2>

        {artist.contract_type === 'Booking' && econ.length === 0 && (
          <small>No hay condiciones configuradas.</small>
        )}

        {econ.map((r) => (
          <div key={r.category} className="row" style={{ borderTop: '1px solid #e5e7eb', paddingTop: 10, marginTop: 10 }}>
            <div style={{ flex:'1 1 220px' }}>
              <div className="badge">{r.category}</div>
            </div>

            {/* Oficina (mostrar sólo si office_pct>0) */}
            {Number(r.office_pct||0) > 0 && (
              <>
                <div style={{ flex:'0 0 120px' }}>
                  <strong>% Oficina</strong>
                  <div>{r.office_pct}%</div>
                </div>
                <div style={{ flex:'0 0 120px' }}>
                  <strong>Base Oficina</strong>
                  <div>{r.office_base === 'net' ? 'Neto' : 'Bruto'}</div>
                </div>
                {Number(r.office_exempt_value||0) > 0 && (
                  <div style={{ flex:'0 0 200px' }}>
                    <strong>Exento Oficina</strong>
                    <div>
                      {r.office_exempt_type === 'percent' ? `${r.office_exempt_value}%` : `${r.office_exempt_value.toLocaleString()} €`}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Artista (no en Caché) */}
            {r.category !== 'Conciertos a caché' && Number(r.artist_pct||0) > 0 && (
              <>
                <div style={{ flex:'0 0 120px' }}>
                  <strong>% Artista</strong>
                  <div>{r.artist_pct}%</div>
                </div>
                <div style={{ flex:'0 0 120px' }}>
                  <strong>Base Artista</strong>
                  <div>{r.artist_base === 'net' ? 'Neto' : 'Bruto'}</div>
                </div>
              </>
            )}

            {/* Modo marcas */}
            {r.category === 'Acciones con marcas' && r.brands_mode && (
              <div style={{ flex:'0 0 220px' }}>
                <strong>Modo</strong>
                <div>{r.brands_mode === 'office_only' ? 'Comisión de oficina' : 'Reparto porcentajes'}</div>
              </div>
            )}
          </div>
        ))}

        {/* Reparto grupo */}
        {artist.is_group && members.length > 0 && (
          <div className="card" style={{ marginTop: 12, background: '#f9fafb' }}>
            <h3 style={{ marginTop: 0 }}>Reparto beneficio artista (grupo)</h3>
            <div className="row">
              {members.map((m)=>(
                <div key={m.id} style={{ flex:'0 0 240px' }}>
                  <strong>{m.full_name}</strong>
                  <div>{(m.share_pct || 0)}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Terceros vinculados */}
      <div className="module">
        <h2>Terceros vinculados</h2>

        {!creatingThird ? (
          <Button onClick={()=>setCreatingThird(true)}>+ Añadir tercero</Button>
        ) : (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="row">
              <div style={{ flex:'1 1 200px' }}><label>Nick</label><input value={newThird.nick} onChange={e=>setNewThird({...newThird, nick:e.target.value})}/></div>
              <div style={{ flex:'1 1 280px' }}><label>Nombre/Compañía</label><input value={newThird.name} onChange={e=>setNewThird({...newThird, name:e.target.value})}/></div>
              <div style={{ flex:'0 0 220px' }}><label>Email</label><input value={newThird.email} onChange={e=>setNewThird({...newThird, email:e.target.value})}/></div>
              <div style={{ flex:'0 0 160px' }}><label>Teléfono</label><input value={newThird.phone} onChange={e=>setNewThird({...newThird, phone:e.target.value})}/></div>
              <div style={{ flex:'0 0 180px' }}><label>NIF/CIF</label><input value={newThird.tax_id} onChange={e=>setNewThird({...newThird, tax_id:e.target.value})}/></div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Button onClick={createThirdInline}>Guardar tercero</Button>
              <Button tone="neutral" onClick={()=>{ setCreatingThird(false); setNewThird({nick:'',name:'',email:'',phone:'',tax_id:''}); }}>Cancelar</Button>
            </div>
          </div>
        )}

        {thirds.length === 0 ? <small>No hay terceros vinculados.</small> : null}
        {thirds.map((t)=>(
          <div key={t.id} className="card">
            <div className="row" style={{ alignItems:'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 12, overflow:'hidden', background:'#f3f4f6' }}>
                {t.logo_url && <img src={t.logo_url} alt={t.nick || t.name || 'tercero'} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
              </div>
              <div style={{ flex:'1 1 auto' }}>
                <a href={`/partners/thirds/${t.id}`} style={{ fontWeight: 600 }}>
                  {t.nick || t.name || 'Sin nombre'}
                </a>
                <div style={{ color:'#6b7280', fontSize:12 }}>
                  {t.email || '—'} · {t.phone || '—'}
                </div>
              </div>
            </div>

            {/* Econ del tercero (solo no vacías) */}
            {t.econ.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {t.econ.filter(e=>Number(e.third_pct||0) > 0).map((e, idx)=>(
                  <div key={idx} className="row" style={{ borderTop:'1px solid #e5e7eb', paddingTop:8 }}>
                    <div style={{ flex:'1 1 220px' }}><div className="badge">{e.category}</div></div>
                    <div style={{ flex:'0 0 120px' }}><strong>%</strong><div>{e.third_pct}%</div></div>
                    <div style={{ flex:'0 0 120px' }}><strong>Base</strong><div>{e.third_base === 'net' ? 'Neto' : 'Bruto'}</div></div>
                    <div style={{ flex:'0 0 200px' }}><strong>Ámbito</strong><div>
                      {e.base_scope === 'office' ? 'Oficina' : e.base_scope === 'artist' ? 'Artista' : 'Total'}
                    </div></div>
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

            {/* Contratos del tercero (del vínculo) */}
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
