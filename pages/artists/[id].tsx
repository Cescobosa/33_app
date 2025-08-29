import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'

export default function ArtistDetail(){
  const { query:{id} } = useRouter()
  const [artist, setArtist] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [econ, setEcon] = useState<any[]>([])
  const [thirds, setThirds] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])

  const load = async () => {
    const { data: a } = await supabase.from('artists').select('*').eq('id', id).single()
    setArtist(a||null)
    const { data: m } = await supabase.from('artist_members').select('*').eq('artist_id', id)
    setMembers(m||[])
    const { data: e } = await supabase.from('artist_economics').select('*').eq('artist_id', id)
    setEcon(e||[])
    const { data: t } = await supabase.from('third_parties').select('*, third_party_economics(*)').eq('artist_id', id).eq('is_active', true)
    setThirds(t||[])
    const { data: c } = await supabase.from('artist_contracts').select('*').eq('artist_id', id).order('signed_at', {ascending:false})
    setContracts(c||[])
  }
  useEffect(()=>{ if(id) load() }, [id])

  const toggleArchive = async () => {
    if (!artist) return
    const { error } = await supabase.from('artists').update({ is_archived: !artist.is_archived }).eq('id', artist.id)
    if (error) return alert(error.message)
    load()
  }

  const show = (v:any)=> v!==null && v!=='' && v!==0

  const econShown = () => {
    if (!econ) return []
    return econ.filter((e:any)=>{
      if (e.category==='Royalties Discográficos') return (e.artist_pct>0)
      if (e.category==='Conciertos a caché') return (e.office_pct>0 || e.office_exempt_value>0)
      if (e.category==='Acciones con marcas') {
        if (e.brands_mode==='office_only') return (e.office_pct>0 || e.office_exempt_value>0)
        return (e.artist_pct>0 || e.office_pct>0 || e.office_exempt_value>0)
      }
      return (e.artist_pct>0 || e.office_pct>0 || e.office_exempt_value>0)
    })
  }

  if (!artist) return <Layout><div className="module">Cargando…</div></Layout>

  return (
    <Layout>
      {/* Cabecera (sin título de módulo) */}
      <div className="module" style={{background:'#fff'}}>
        <div className="row" style={{alignItems:'center'}}>
          {artist.photo_url ? <img src={artist.photo_url} style={{width:80, height:80, borderRadius:12, objectFit:'cover'}}/> : null}
          <h1 style={{marginLeft:12}}>{artist.stage_name}</h1>
          <Link href={`/artists/${artist.id}/edit`} className="badge" style={{marginLeft:'auto'}}>✏️ Editar</Link>
          <button style={{marginLeft:8}} onClick={toggleArchive}>{artist.is_archived ? 'Recuperar' : 'Archivar'}</button>
        </div>
      </div>

      {/* Datos personales */}
      <div className="module">
        <h2>Datos personales</h2>
        <div className="row">
          {show(artist.full_name) && <div><b>Nombre completo:</b> {artist.full_name}</div>}
          {show(artist.dni) && <div><b>DNI:</b> {artist.dni} {artist.dni_front_url || artist.dni_back_url ? <a href={artist.dni_front_url||'#'} target="_blank" rel="noreferrer" style={{marginLeft:8}}>🪪 DNI</a>:null}</div>}
          {show(artist.birth_date) && <div><b>Nacimiento:</b> {artist.birth_date}</div>}
        </div>

        {artist.is_group && (
          <>
            <h3 style={{marginTop:10}}>Miembros del grupo</h3>
            {members.length===0 ? <small>—</small> : members.map((m:any)=>(
              <div key={m.id} className="row" style={{borderTop:'1px solid #e5e7eb', paddingTop:8, marginTop:8}}>
                <div><b>{m.full_name}</b></div>
                {m.dni && <div className="badge">{m.dni}</div>}
                {(m.dni_front_url || m.dni_back_url) && <a href={m.dni_front_url||'#'} target="_blank" rel="noreferrer">🪪 DNI</a>}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Datos fiscales */}
      <div className="module">
        <h2>Datos fiscales</h2>
        <div className="row">
          <div><b>Tipo:</b> {artist.tax_type}</div>
          {show(artist.tax_name) && <div><b>Nombre fiscal:</b> {artist.tax_name}</div>}
          {show(artist.tax_id) && <div><b>NIF/CIF:</b> {artist.tax_id}</div>}
          {show(artist.iban) && <div><b>IBAN:</b> {artist.iban}</div>}
        </div>
        {(artist.fiscal_address_line || artist.fiscal_city || artist.fiscal_province || artist.fiscal_postal_code || artist.fiscal_country) && (
          <div className="row" style={{marginTop:6}}>
            <div><b>Domicilio fiscal:</b> {artist.fiscal_address_line || ''} {artist.fiscal_city||''} {artist.fiscal_province||''} {artist.fiscal_postal_code||''} {artist.fiscal_country||''}</div>
          </div>
        )}
        {(artist.manager_name || artist.manager_email || artist.manager_phone) && (
          <div className="row" style={{marginTop:6}}>
            <div><b>Gestor:</b> {artist.manager_name||''} {artist.manager_phone?` · ${artist.manager_phone}`:''} {artist.manager_email?` · ${artist.manager_email}`:''}</div>
          </div>
        )}
        {(artist.notify_name || artist.notify_email) && (
          <div className="row" style={{marginTop:6}}>
            <div><b>Notificar liquidaciones a:</b> {artist.notify_name||''} {artist.notify_email?` · ${artist.notify_email}`:''}</div>
          </div>
        )}
      </div>

      {/* Condiciones económicas */}
      <div className="module">
        <h2>Condiciones económicas</h2>
        {econShown().length===0 ? <small>—</small> : econShown().map((e:any)=>(
          <div key={e.id} className="card" style={{marginTop:8}}>
            <div className="row" style={{alignItems:'center'}}>
              <div className="badge">{e.category}</div>
              {e.category==='Acciones con marcas' && e.brands_mode && <div style={{marginLeft:8}}><b>Modo:</b> {e.brands_mode==='office_only'?'Comisión de oficina':'Reparto porcentajes'}</div>}
            </div>
            <div className="row" style={{marginTop:6}}>
              {e.artist_pct>0 && <div><b>% Artista:</b> {e.artist_pct}% ({e.artist_base==='gross'?'Bruto':'Neto'})</div>}
              {e.office_pct>0 && <div><b>% Oficina:</b> {e.office_pct}% ({e.office_base==='gross'?'Bruto':'Neto'})</div>}
              {e.office_exempt_value>0 && <div><b>Exento Oficina:</b> {e.office_exempt_type==='percent'? `${e.office_exempt_value}%` : `${e.office_exempt_value} €`}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Contratos */}
      <div className="module">
        <h2>Contratos</h2>
        {contracts.length===0 ? <small>—</small> : contracts.map((c:any)=>(
          <div key={c.id} className="row" style={{alignItems:'center', borderTop:'1px solid #e5e7eb', paddingTop:8, marginTop:8}}>
            <div className="badge" style={{background:c.is_active?'#e8fff0':'#f1f5f9', borderColor:c.is_active?'#86efac':'#e5e7eb'}}>
              {c.is_active ? 'VIGENTE' : '—'}
            </div>
            <div style={{marginLeft:8}}><b>{c.name}</b></div>
            {c.signed_at && <div style={{marginLeft:8}}>{c.signed_at}</div>}
            <a href={c.file_url} target="_blank" rel="noreferrer" style={{marginLeft:'auto'}}>📄 Descargar</a>
          </div>
        ))}
      </div>

      {/* Terceros vinculados */}
      <div className="module">
        <h2>Terceros vinculados</h2>
        {thirds.length===0 ? (
          <div><small>No hay terceros activos.</small> <Link className="badge" href={`/artists/${artist.id}/edit#thirds`}>+ Añadir tercero</Link></div>
        ) : thirds.map((t:any)=>(
          <div key={t.id} className="card" style={{marginTop:8}}>
            <div className="row" style={{alignItems:'center'}}>
              {t.logo_url ? <img src={t.logo_url} style={{width:32,height:32,borderRadius:8,objectFit:'cover'}}/> : null}
              <Link href={`/partners/thirds/${t.id}`} style={{marginLeft:8, fontWeight:700}}>{t.nick || t.name}</Link>
              {t.contract_url ? <a href={t.contract_url} target="_blank" rel="noreferrer" style={{marginLeft:'auto'}}>📄 Contrato</a> : null}
            </div>
            {(t.third_party_economics||[]).filter((e:any)=>e.third_pct>0).map((e:any)=>(
              <div key={e.id} className="row" style={{marginTop:6}}>
                <div className="badge">{e.category}</div>
                <div><b>%</b> {e.third_pct}%</div>
                <div><b>Base</b> {e.third_base==='gross'?'Bruto':'Neto'} · <b>Ámbito</b> {e.base_scope}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Layout>
  )
}
