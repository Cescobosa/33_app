import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../../../lib/supabaseClient'
import Layout from '../../../components/Layout'

export default function ThirdDetail(){
  const { query:{id} } = useRouter()
  const [row, setRow] = useState<any>(null)
  const [contracts, setContracts] = useState<any[]>([])
  const [linkedArtists, setLinkedArtists] = useState<any[]>([])

  const load = async () => {
    const { data: t } = await supabase.from('third_parties').select('*').eq('id', id).single()
    setRow(t||null)
    const { data: c } = await supabase.from('third_party_contracts').select('*').eq('third_party_id', id).order('signed_at', {ascending:false})
    setContracts(c||[])
    // artistas a los que está vinculado (económicas)
    const { data: links } = await supabase
      .from('third_party_economics')
      .select('third_party_id, category, third_pct, third_base, base_scope, third_exempt_type, third_exempt_value, third_parties!inner(name,logo_url), third_parties(artist_id)')
      .eq('third_party_id', id)
    // simplificado: buscamos artistas por artist_id presentes en third_parties de este tercero
    const { data: arts } = await supabase.from('third_parties').select('artist_id, artists!inner(id, stage_name, photo_url)').eq('id', id as any)
    setLinkedArtists((arts||[]).map((a:any)=>a.artists))
  }
  useEffect(()=>{ if(id) load() }, [id])

  const toggleActive = async () => {
    if (!row) return
    const { error } = await supabase.from('third_parties').update({ is_active: !row.is_active }).eq('id', row.id)
    if (error) return alert(error.message)
    load()
  }

  if (!row) return <Layout><div className="module">Cargando…</div></Layout>

  const show = (v:any)=> v!==null && v!=='' && v!==0
  return (
    <Layout>
      {/* Cabecera */}
      <div className="module" style={{background:'#fff'}}>
        <div className="row" style={{alignItems:'center'}}>
          {row.logo_url ? <img src={row.logo_url} style={{width:80,height:80,borderRadius:12,objectFit:'cover'}}/> : null}
          <h1 style={{marginLeft:12}}>{row.nick || row.name}</h1>
          <Link href={`/partners/thirds/${row.id}/edit`} className="badge" style={{marginLeft:'auto'}}>✏️ Editar</Link>
          <button style={{marginLeft:8}} onClick={toggleActive}>{row.is_active ? 'Archivar' : 'Recuperar'}</button>
        </div>
      </div>

      {/* Datos personales / fiscales (módulos) */}
      <div className="module">
        <h2>Datos personales</h2>
        <div className="row">
          {show(row.name) && <div><b>Nombre:</b> {row.name}</div>}
          {show(row.phone) && <div><b>Teléfono:</b> {row.phone}</div>}
          {show(row.email) && <div><b>Email:</b> {row.email}</div>}
        </div>
      </div>

      <div className="module">
        <h2>Datos fiscales</h2>
        <div className="row">
          {show(row.tax_type) && <div><b>Tipo:</b> {row.tax_type}</div>}
          {show(row.tax_id) && <div><b>NIF/CIF:</b> {row.tax_id}</div>}
          {show(row.tax_name) && <div><b>Nombre fiscal:</b> {row.tax_name}</div>}
        </div>
        {(row.fiscal_address_line || row.fiscal_city || row.fiscal_province || row.fiscal_postal_code || row.fiscal_country) && (
          <div className="row" style={{marginTop:6}}>
            <div><b>Domicilio fiscal:</b> {row.fiscal_address_line || ''} {row.fiscal_city||''} {row.fiscal_province||''} {row.fiscal_postal_code||''} {row.fiscal_country||''}</div>
          </div>
        )}
        {(row.manager_name || row.manager_email || row.manager_phone) && (
          <div className="row" style={{marginTop:6}}>
            <div><b>Gestor:</b> {row.manager_name||''} {row.manager_phone?` · ${row.manager_phone}`:''} {row.manager_email?` · ${row.manager_email}`:''}</div>
          </div>
        )}
        {(row.notify_name || row.notify_email) && (
          <div className="row" style={{marginTop:6}}>
            <div><b>Notificar liquidaciones a:</b> {row.notify_name||''} {row.notify_email?` · ${row.notify_email}`:''}</div>
          </div>
        )}
      </div>

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

      <div className="module">
        <h2>Vinculado con artistas</h2>
        {linkedArtists.length===0 ? <small>—</small> : (
          <div className="row">
            {linkedArtists.map((a:any)=>(
              <Link key={a.id} className="badge" href={`/artists/${a.id}`}>
                {a.stage_name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
