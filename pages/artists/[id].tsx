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
}

export default function ArtistDetail() {
  const router = useRouter()
  const { id } = router.query as { id: string }
  const [artist, setArtist] = useState<Artist|null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [econ, setEcon] = useState<any[]>([])
  const [thirds, setThirds] = useState<any[]>([])

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data: a } = await supabase.from('artists').select('*').eq('id', id).single()
      setArtist(a as any)

      const { data: m } = await supabase.from('artist_members').select('*').eq('artist_id', id)
      setMembers(m ?? [])

      const { data: e } = await supabase.from('artist_economics').select('*').eq('artist_id', id)
      setEcon(e ?? [])

      const { data: t } = await supabase.from('third_parties').select('*, third_party_economics(*)').eq('artist_id', id)
      setThirds(t ?? [])
    })()
  }, [id])

  if (!artist) return <div className="container"><Nav/><div className="card">Cargando…</div></div>

  return (
    <div className="container">
      <Nav/>
      <h1>{artist.stage_name}</h1>
      <div className="row">
        <div className="card" style={{flex:'1 1 360px'}}>
          {artist.photo_url ? <img className="thumb" src={artist.photo_url} alt="foto"/> : <div className="badge">sin foto</div>}
          <div><b>Nombre completo:</b> {artist.full_name ?? '—'}</div>
          <div><b>DNI:</b> {artist.dni ?? '—'}</div>
          <div><b>Nacimiento:</b> {artist.birth_date ?? '—'}</div>
          <div><b>Contrato:</b> {artist.contract_type}</div>
          <div><b>Fiscal:</b> {artist.tax_type} — {artist.tax_name ?? '—'} / {artist.tax_id ?? '—'}</div>
          <div><b>IBAN:</b> {artist.iban ?? '—'}</div>
          <div style={{marginTop:8}}>
            {artist.contract_url ? <a href={artist.contract_url} target="_blank" rel="noreferrer">📄 Descargar contrato</a> : <small>sin contrato</small>}
          </div>
          <div style={{marginTop:12}}>
            <Link href={`/artists/${artist.id}/edit`} className="badge">✏️ Editar</Link>
          </div>
        </div>

        <div className="card" style={{flex:'2 1 520px'}}>
          <h2>Condiciones económicas</h2>
          {artist.contract_type === 'Booking' ? (
            <div>
              {/* Para Booking solo mostramos fila Booking si existe */}
              {econ.filter(e=>e.category==='Booking').map((e:any)=>(
                <div key={e.id} className="row" style={{borderTop:'1px solid #1f2937', paddingTop:8, marginTop:8}}>
                  <div className="badge">Booking</div>
                  <div><b>% Oficina:</b> {e.office_pct}%</div>
                  <div><b>Base:</b> {e.office_base==='gross'?'Bruto':'Neto'}</div>
                  <div><b>Exento:</b> {e.office_exempt_type==='percent'? `${e.office_exempt_value}%` : `${e.office_exempt_value} €`}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {econ.map((e:any)=>(
                <div key={e.id} className="row" style={{borderTop:'1px solid #1f2937', paddingTop:8, marginTop:8}}>
                  <div className="badge">{e.category}</div>
                  <div><b>% Artista:</b> {e.artist_pct}%</div>
                  <div><b>% Oficina:</b> {e.office_pct}%</div>
                  <div><b>Base Artista:</b> {e.artist_base==='gross'?'Bruto':'Neto'}</div>
                  <div><b>Base Oficina:</b> {e.office_base==='gross'?'Bruto':'Neto'}</div>
                  <div><b>Exento (Oficina):</b> {e.office_exempt_type==='percent'? `${e.office_exempt_value}%` : `${e.office_exempt_value} €`}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Miembros del grupo</h2>
        {members.length===0 ? <small>—</small> : members.map((m:any)=>(
          <div key={m.id} className="row"><div>{m.full_name}</div><div className="badge">{m.dni ?? ''}</div></div>
        ))}
      </div>

      <div className="card">
        <h2>Terceros</h2>
        {thirds.length===0 ? <small>—</small> : thirds.map((t:any)=>(
          <div key={t.id} style={{borderTop:'1px solid #1f2937', paddingTop:8, marginTop:8}}>
            <div className="row" style={{alignItems:'center'}}>
              <div className="badge">{t.nick || 'Tercero'}</div>
              <div>{t.name}</div>
              {t.contract_url ? <a href={t.contract_url} target="_blank" rel="noreferrer" style={{marginLeft:12}}>📄 Contrato</a> : <small style={{marginLeft:12}}>sin contrato</small>}
            </div>
            {(t.third_party_economics||[]).map((e:any)=>(
              <div key={e.id} className="row" style={{marginTop:6}}>
                <div className="badge">{e.category}</div>
                <div><b>%</b> {e.third_pct}%</div>
                <div><b>Base</b> {e.third_base==='gross'?'Bruto':'Neto'} / <b>Ámbito</b> {e.base_scope}</div>
                <div><b>Exento</b> {e.third_exempt_type==='percent'? `${e.third_exempt_value}%` : `${e.third_exempt_value} €`}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
