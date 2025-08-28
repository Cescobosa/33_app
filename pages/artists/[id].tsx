import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import Nav from '../../components/Nav'

type Artist = {
  id: string
  stage_name: string
  full_name: string | null
  dni: string | null
  birth_date: string | null
  is_group: boolean
  contract_type: 'General' | 'Booking'
  tax_type: 'particular' | 'empresa'
  tax_name: string | null
  tax_id: string | null
  iban: string | null
  photo_url: string | null
  contract_url: string | null
  is_archived: boolean
}

export default function ArtistDetail() {
  const router = useRouter()
  const { id } = router.query as { id: string }
  const [artist, setArtist] = useState<Artist|null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [econ, setEcon] = useState<any[]>([])
  const [thirds, setThirds] = useState<any[]>([])

  const load = async () => {
    if (!id) return
    const { data: a } = await supabase.from('artists').select('*').eq('id', id).single()
    setArtist(a as any)
    const { data: m } = await supabase.from('artist_members').select('*').eq('artist_id', id)
    setMembers(m ?? [])
    const { data: e } = await supabase.from('artist_economics').select('*').eq('artist_id', id)
    setEcon(e ?? [])
    const { data: t } = await supabase.from('third_parties').select('*, third_party_economics(*)').eq('artist_id', id).eq('is_active', true)
    setThirds(t ?? [])
  }

  useEffect(() => { load() }, [id])

  const toggleArchive = async () => {
    if (!artist) return
    const { error } = await supabase.from('artists').update({ is_archived: !artist.is_archived }).eq('id', artist.id)
    if (error) return alert(error.message)
    load()
  }

  if (!artist) return <div className="container"><Nav/><div className="card">Cargando…</div></div>

  const nonEmpty = (v:any) => v !== null && v !== '' && v !== 0
  const econRows = () => {
    if (artist.contract_type === 'Booking') {
      return econ.filter((e:any)=> e.category==='Booking' && (e.office_pct>0 || e.office_exempt_value>0))
    }
    return econ.filter((e:any)=>{
      if (e.category === 'Royalties Discográficos') return e.artist_pct > 0
      if (e.category === 'Conciertos a caché') return e.office_pct > 0 || e.office_exempt_value>0
      if (e.category === 'Acciones con marcas') {
        if (e.brands_mode === 'office_only') return e.office_pct>0 || e.office_exempt_value>0
        return (e.artist_pct>0 || e.office_pct>0 || e.office_exempt_value>0)
      }
      return (e.artist_pct>0 || e.office_pct>0 || e.office_exempt_value>0)
    })
  }

  return (
    <div className="container">
      <Nav/>

      <div className="row" style={{alignItems:'center'}}>
        <h1 style={{marginRight:12}}>{artist.stage_name}</h1>
        <Link href={`/artists/${artist.id}/edit`} className="badge">✏️ Editar</Link>
        <button style={{marginLeft:8}} onClick={toggleArchive}>{artist.is_archived ? 'Recuperar' : 'Archivar'}</button>
      </div>

      <div className="row">
        <div className="card" style={{flex:'1 1 360px'}}>
          {artist.photo_url ? <img className="thumb" src={artist.photo_url} alt="foto"/> : null}
          {nonEmpty(artist.full_name) && <div><b>Nombre completo:</b> {artist.full_name}</div>}
          {nonEmpty(artist.dni) && <div><b>DNI:</b> {artist.dni}</div>}
          {nonEmpty(artist.birth_date) && <div><b>Nacimiento:</b> {artist.birth_date}</div>}
          {nonEmpty(artist.contract_type) && <div><b>Contrato:</b> {artist.contract_type}</div>}
          {nonEmpty(artist.tax_type) && <div><b>Fiscal:</b> {artist.tax_type} {artist.tax_name ? ` — ${artist.tax_name}`:''} {artist.tax_id?` / ${artist.tax_id}`:''}</div>}
          {nonEmpty(artist.iban) && <div><b>IBAN:</b> {artist.iban}</div>}
          {artist.contract_url && <div style={{marginTop:8}}><a href={artist.contract_url} target="_blank" rel="noreferrer">📄 Descargar contrato</a></div>}
        </div>

        <div className="card" style={{flex:'2 1 520px'}}>
          <h2>Condiciones económicas</h2>
          {econRows().length===0 ? <small>—</small> : econRows().map((e:any)=>(
            <div key={e.id} className="row" style={{borderTop:'1px solid #1f2937', paddingTop:8, marginTop:8}}>
              <div className="badge">{e.category}</div>
              {e.category==='Acciones con marcas' && e.brands_mode && <div><b>Modo:</b> {e.brands_mode==='office_only'?'Comisión de oficina':'Reparto porcentajes'}</div>}
              {e.artist_pct>0 && <div><b>% Artista:</b> {e.artist_pct}%</div>}
              {e.office_pct>0 && <div><b>% Oficina:</b> {e.office_pct}%</div>}
              {e.artist_base && e.artist_pct>0 && <div><b>Base Artista:</b> {e.artist_base==='gross'?'Bruto':'Neto'}</div>}
              {e.office_base && e.office_pct>0 && <div><b>Base Oficina:</b> {e.office_base==='gross'?'Bruto':'Neto'}</div>}
              {e.office_exempt_value>0 && <div><b>Exento Oficina:</b> {e.office_exempt_type==='percent'? `${e.office_exempt_value}%` : `${e.office_exempt_value} €`}</div>}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Miembros del grupo</h2>
        {members.length===0 ? <small>—</small> : members.map((m:any)=>(
          <div key={m.id} className="row"><div>{m.full_name}</div>{m.dni?<div className="badge">{m.dni}</div>:null}</div>
        ))}
      </div>

      <div className="card">
        <h2>Terceros</h2>
        {thirds.length===0 ? (
          <div>
            <small>No hay terceros activos.</small>{' '}
            <Link href={`/artists/${artist.id}/edit#thirds`} className="badge">+ Añadir tercero</Link>
          </div>
        ) : thirds.map((t:any)=>(
          <div key={t.id} style={{borderTop:'1px solid #1f2937', paddingTop:8, marginTop:8}}>
            <div className="row" style={{alignItems:'center'}}>
              {t.logo_url ? <img src={t.logo_url} alt="logo" style={{width:36, height:36, borderRadius:8, objectFit:'cover'}}/> : null}
              <div className="badge" style={{marginLeft:8}}>{t.nick || 'Tercero'}</div>
              <div style={{marginLeft:8}}>{t.name}</div>
              {t.contract_url ? <a href={t.contract_url} target="_blank" rel="noreferrer" style={{marginLeft:12}}>📄 Contrato</a> : null}
            </div>
            {(t.third_party_economics||[]).map((e:any)=>(
              (e.third_pct>0) ? (
                <div key={e.id} className="row" style={{marginTop:6}}>
                  <div className="badge">{e.category}</div>
                  <div><b>%</b> {e.third_pct}%</div>
                  <div><b>Base</b> {e.third_base==='gross'?'Bruto':'Neto'} / <b>Ámbito</b> {e.base_scope}</div>
                  {e.third_exempt_value>0 && <div><b>Exento</b> {e.third_exempt_type==='percent'? `${e.third_exempt_value}%` : `${e.third_exempt_value} €`}</div>}
                </div>
              ) : null
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
