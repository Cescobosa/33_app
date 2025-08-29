import { useEffect, useState } from 'react'
import Layout from '../../../components/Layout'
import { supabase } from '../../../lib/supabaseClient'
import Button from '../../../components/Button'

type Artist = any

export default function ArtistShow() {
  const [a,setA]=useState<Artist|null>(null)
  const [econ,setEcon]=useState<any[]>([])
  const [members,setMembers]=useState<any[]>([])
  const [thirds,setThirds]=useState<any[]>([])
  const [loading,setLoading]=useState(true)

  async function load() {
    setLoading(true)
    const id = window.location.pathname.split('/').pop()
    const { data: artist } = await supabase.from('artists').select('*').eq('id', id).single()
    const { data: e } = await supabase.from('artist_economics').select('*').eq('artist_id', id).order('category')
    const { data: m } = await supabase.from('artist_members').select('*').eq('artist_id', id).order('full_name')
    const { data: t } = await supabase.from('third_parties').select('*, third_party_economics(*)').eq('artist_id', id).order('nick')
    setA(artist||null); setEcon(e||[]); setMembers(m||[]); setThirds(t||[])
    setLoading(false)
  }
  useEffect(()=>{ load() },[])

  if (loading) return <Layout><div className="module">Cargando…</div></Layout>
  if (!a) return <Layout><div className="module">No encontrado</div></Layout>

  return (
    <Layout>
      {/* Cabecera */}
      <div className="module" style={{display:'flex', alignItems:'center', gap:16}}>
        <div style={{width:96,height:96,borderRadius:12,overflow:'hidden',background:'#f3f4f6'}}>
          {a.photo_url ? <img src={a.photo_url} alt={a.stage_name} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : null}
        </div>
        <div style={{flex:'1 1 auto'}}>
          <h1 style={{margin:'0 0 4px'}}>{a.stage_name}</h1>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            <span className="badge">{a.contract_type}</span>
            <span className="badge">{a.is_group ? 'Grupo' : 'Solista'}</span>
          </div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <a className="btn" href={`/artists/${a.id}/edit`}>Editar</a>
          <a className="btn-neutral" href="/artists">Volver</a>
        </div>
      </div>

      {/* Datos personales */}
      <div className="module">
        <h2>Datos personales</h2>
        {!a.is_group ? (
          <div className="row">
            {a.full_name ? <div style={{flex:'1 1 260px'}}><b>Nombre completo</b><div>{a.full_name}</div></div> : null}
            {a.dni ? <div style={{flex:'1 1 160px'}}><b>DNI</b><div>{a.dni}</div></div> : null}
            {a.birth_date ? <div style={{flex:'1 1 160px'}}><b>Nacimiento</b><div>{a.birth_date}</div></div> : null}
            {a.email ? <div style={{flex:'1 1 260px'}}><b>Email</b><div>{a.email}</div></div> : null}
            {a.phone ? <div style={{flex:'1 1 160px'}}><b>Teléfono</b><div>{a.phone}</div></div> : null}
          </div>
        ) : (
          <div>
            {members.map((m:any)=>(
              <div key={m.id} className="card">
                <div className="row">
                  <div style={{flex:'1 1 260px'}}><b>Nombre</b><div>{m.full_name}</div></div>
                  {m.dni ? <div style={{flex:'1 1 160px'}}><b>DNI</b><div>{m.dni}</div></div> : null}
                  {m.birth_date ? <div style={{flex:'1 1 160px'}}><b>Nacimiento</b><div>{m.birth_date}</div></div> : null}
                </div>
                <div className="row">
                  {m.email ? <div style={{flex:'1 1 260px'}}><b>Email</b><div>{m.email}</div></div> : null}
                  {m.phone ? <div style={{flex:'1 1 160px'}}><b>Teléfono</b><div>{m.phone}</div></div> : null}
                  <div style={{flex:'1 1 140px'}}><b>Reparto %</b><div>{m.share_pct ?? 0}%</div></div>
                </div>
                <div className="row">
                  <div style={{flex:'1 1 160px'}}><b>Tipo fiscal</b><div>{m.tax_type}</div></div>
                  <div style={{flex:'1 1 260px'}}><b>Nombre fiscal/Empresa</b><div>{m.tax_type==='particular' ? (m.full_name||'') : (m.tax_name||'')}</div></div>
                  <div style={{flex:'1 1 200px'}}><b>NIF/CIF</b><div>{m.tax_type==='particular' ? (m.dni||'') : (m.tax_id||'')}</div></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Datos fiscales (individual) */}
      {!a.is_group && (a.tax_type || a.iban) && (
        <div className="module">
          <h2>Datos fiscales</h2>
          <div className="row">
            {a.tax_type ? <div style={{flex:'1 1 160px'}}><b>Tipo</b><div>{a.tax_type}</div></div> : null}
            {a.tax_name ? <div style={{flex:'1 1 260px'}}><b>Nombre fiscal / Empresa</b><div>{a.tax_name}</div></div> : null}
            {a.tax_id ? <div style={{flex:'1 1 200px'}}><b>NIF/CIF</b><div>{a.tax_id}</div></div> : null}
            {a.iban ? <div style={{flex:'1 1 300px'}}><b>IBAN</b><div>{a.iban}</div></div> : null}
          </div>
        </div>
      )}

      {/* Económicas (mostrar solo una vez por concepto) */}
      <div className="module">
        <h2>Condiciones económicas</h2>
        {econ.map((r:any)=>(
          <div key={r.id} className="row" style={{borderTop:'1px solid #e5e7eb', paddingTop:8, marginTop:8}}>
            <div style={{flex:'1 1 220px'}}><div className="badge">{r.category}</div></div>
            {r.category!=='Royalties Discográficos' && (
              <>
                <div style={{flex:'1 1 120px'}}><b>% Oficina</b><div>{r.office_pct}%</div></div>
                <div style={{flex:'1 1 140px'}}><b>Base Oficina</b><div>{r.office_base}</div></div>
                <div style={{flex:'1 1 220px'}}><b>Exento Of.</b><div>{r.office_exempt_type==='percent' ? `${r.office_exempt_value}%` : `${r.office_exempt_value} €`}</div></div>
              </>
            )}
            {!(r.category==='Conciertos a caché' || (r.category==='Acciones con marcas' && r.brands_mode==='office_only')) && (
              <>
                <div style={{flex:'1 1 120px'}}><b>% Artista</b><div>{r.artist_pct}%</div></div>
                <div style={{flex:'1 1 140px'}}><b>Base Artista</b><div>{r.artist_base}</div></div>
              </>
            )}
            {r.category==='Acciones con marcas' ? (
              <div style={{flex:'1 1 180px'}}><b>Modo</b><div>{r.brands_mode||'split'}</div></div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Terceros vinculados */}
      <div className="module">
        <h2>Terceros vinculados</h2>
        {(thirds||[]).length===0 ? <div>No hay terceros. <a className="btn" href={`/artists/${a.id}/edit#thirds`}>+ Añadir</a></div> : null}
        {(thirds||[]).map((t:any)=>(
          <div key={t.id} className="card">
            <div className="row" style={{alignItems:'center'}}>
              <div style={{width:48,height:48,borderRadius:8,overflow:'hidden',background:'#f3f4f6'}}>
                {t.logo_url ? <img src={t.logo_url} alt={t.nick||t.name||''} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : null}
              </div>
              <div style={{flex:'1 1 auto', fontWeight:700}}>{t.nick||t.name}</div>
            </div>
            <div style={{marginTop:8}}>
              {(t.third_party_economics||[]).map((e:any)=>(
                <div key={e.id} className="row" style={{borderTop:'1px solid #e5e7eb', paddingTop:6, marginTop:6}}>
                  <div style={{flex:'1 1 220px'}}><div className="badge">{e.category}</div></div>
                  <div style={{flex:'1 1 120px'}}><b>%</b><div>{e.third_pct}%</div></div>
                  <div style={{flex:'1 1 140px'}}><b>Base</b><div>{e.third_base}</div></div>
                  <div style={{flex:'1 1 180px'}}><b>Ámbito</b><div>{e.base_scope}</div></div>
                  <div style={{flex:'1 1 200px'}}><b>Exento</b><div>{e.third_exempt_type==='percent' ? `${e.third_exempt_value}%` : `${e.third_exempt_value} €`}</div></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Contratos */}
      {a.contract_url && (
        <div className="module">
          <h2>Contratos</h2>
          <a className="btn" href={a.contract_url} target="_blank" rel="noreferrer">Descargar contrato</a>
        </div>
      )}
    </Layout>
  )
}
