import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'
import Button from '../../components/ui/Button'
import HeaderCard from '../../components/HeaderCard'

type Artist = {
  id: string
  stage_name: string
  full_name: string | null
  photo_url: string | null
  is_group: boolean
  contract_type: 'General' | 'Booking'
  tax_type: 'particular' | 'empresa'
  tax_name: string | null
  tax_id: string | null
  iban: string | null
  is_archived?: boolean | null
}

export default function ArtistView() {
  const router = useRouter()
  const { id } = router.query as { id: string }

  const [artist, setArtist] = useState<Artist | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [econ, setEcon] = useState<any[]>([])
  const [thirds, setThirds] = useState<any[]>([])
  const [artistContracts, setArtistContracts] = useState<any[]>([])
  const [thirdContracts, setThirdContracts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      setLoading(true)
      setErr(null)
      try {
        const { data: a, error: e1 } = await supabase.from('artists').select('*').eq('id', id).single()
        if (e1) throw e1
        setArtist(a as any)

        const [{ data: m }, { data: ec }, { data: tp }, { data: ac }, { data: tc }] = await Promise.all([
          supabase.from('artist_members').select('*').eq('artist_id', id),
          supabase.from('artist_economics').select('*').eq('artist_id', id),
          supabase.from('third_parties').select('*, third_party_economics(*)').eq('artist_id', id).eq('kind','third'),
          supabase.from('artist_contracts').select('*').eq('artist_id', id).order('signed_at', { ascending: false }),
          supabase.from('third_party_contracts').select('*').eq('artist_id', id).order('signed_at', { ascending: false }),
        ])

        setMembers(m || [])
        setEcon(ec || [])
        setThirds(tp || [])
        setArtistContracts(ac || [])
        setThirdContracts(tc || [])
      } catch (e: any) {
        setErr(e.message || 'Error')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const econByCategory = useMemo(() => {
    const map: Record<string, any> = {}
    for (const r of econ || []) if (!map[r.category]) map[r.category] = r
    return Object.values(map)
  }, [econ])

  const contractsByThird: Record<string, any[]> = useMemo(() => {
    const out: Record<string, any[]> = {}
    for (const c of thirdContracts || []) (out[c.third_party_id] = out[c.third_party_id] || []).push(c)
    return out
  }, [thirdContracts])

  const archiveToggle = async () => {
    if (!artist) return
    const wantDelete = !artist.is_archived ? confirm('¿Archivar este artista?') : confirm('¿Recuperar artista?')
    if (!wantDelete) return
    await supabase.from('artists').update({ is_archived: !artist.is_archived }).eq('id', artist.id)
    router.replace(router.asPath)
  }

  if (loading) return <Layout><div className="module">Cargando…</div></Layout>
  if (err || !artist) return <Layout><div className="module" style={{color:'#d42842'}}>Error: {err || 'No encontrado'}</div></Layout>

  return (
    <Layout>
      {/* Botonera superior */}
      <div className="row" style={{ alignItems:'center', gap:8, marginBottom: 8 }}>
        <Button as="a" href={`/artists/${artist.id}/edit`} icon="edit">Editar</Button>
        <Button tone={artist.is_archived ? 'ghost' : 'danger'} icon={artist.is_archived ? 'restore' : 'archive'} onClick={archiveToggle}>
          {artist.is_archived ? 'Recuperar' : 'Archivar'}
        </Button>
      </div>

      <HeaderCard photoUrl={artist.photo_url} title={artist.stage_name} />

      <div className="module">
        <h2>Datos básicos</h2>
        <div className="row">
          <div><strong>Contrato:</strong> {artist.contract_type}</div>
          {artist.full_name && <div><strong>Nombre completo:</strong> {artist.full_name}</div>}
          {artist.tax_type && <div><strong>Tipo fiscal:</strong> {artist.tax_type === 'particular' ? 'Particular' : 'Empresa vinculada'}</div>}
          {artist.tax_name && <div><strong>Nombre fiscal/Empresa:</strong> {artist.tax_name}</div>}
          {artist.tax_id && <div><strong>NIF/CIF:</strong> {artist.tax_id}</div>}
          {artist.iban && <div><strong>IBAN:</strong> {artist.iban}</div>}
        </div>
      </div>

      {artist.is_group && (
        <div className="module">
          <h2>Miembros del grupo</h2>
          {(members||[]).map((m:any)=>(
            <div key={m.id} className="row" style={{gap:8}}>
              <div style={{flex:'1 1 auto'}}>{m.full_name}</div>
              {m.dni && <div>DNI: {m.dni}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="module">
        <h2>Condiciones económicas</h2>
        {econByCategory
          .filter((r:any)=>[r.artist_pct, r.office_pct, r.office_exempt_value].some(v=>typeof v==='number' && v>0))
          .map((r:any, i:number)=>(
          <div key={i} className="row" style={{borderTop:'1px solid #e5e7eb', paddingTop:12, marginTop:12}}>
            <div className="badge" style={{flex:'0 0 260px'}}>{r.category}</div>
            {r.category!=='Conciertos a caché' && r.category!=='Acciones con marcas' && r.category!=='Royalties Discográficos' && (
              <div><strong>% Artista:</strong> {r.artist_pct ?? 0}</div>
            )}
            {r.category==='Royalties Discográficos' && (
              <>
                <div><strong>% Artista:</strong> {r.artist_pct ?? 0}</div>
                <div><strong>Base Artista:</strong> {r.artist_base==='net'?'Neto':'Bruto'}</div>
              </>
            )}
            {r.category!=='Royalties Discográficos' && (
              <>
                <div><strong>% Oficina:</strong> {r.office_pct ?? 0}</div>
                <div><strong>Base Oficina:</strong> {r.office_base==='net'?'Neto':'Bruto'}</div>
                {(r.office_exempt_value||0)>0 && (
                  <div><strong>Exento oficina:</strong> {r.office_exempt_type==='percent' ? `${r.office_exempt_value}%` : `${r.office_exempt_value}€`}</div>
                )}
              </>
            )}
            {r.category==='Acciones con marcas' && r.brands_mode && (
              <div><strong>Modo marcas:</strong> {r.brands_mode==='office_only'?'Comisión de oficina':'Reparto porcentajes'}</div>
            )}
          </div>
        ))}
      </div>

      <div className="module">
        <h2>Terceros vinculados</h2>
        {(thirds||[]).filter((t:any)=>t.is_active!==false).length===0 && <div>No hay terceros vinculados.</div>}

        {(thirds||[]).filter((t:any)=>t.is_active!==false)
          .sort((a:any,b:any)=> (a.nick||a.name||'').localeCompare(b.nick||b.name||''))}
        {(thirds||[]).filter((t:any)=>t.is_active!==false).map((t:any)=>(
          <div key={t.id} className="card" style={{marginTop:12}}>
            <div className="row" style={{alignItems:'center', gap:12}}>
              <img src={t.logo_url||''} alt="" style={{width:48,height:48,borderRadius:8,objectFit:'cover',background:'#f3f4f6'}}/>
              <a href={`/partners/thirds/${t.id}`} style={{fontWeight:600}}>{t.nick || t.name}</a>
            </div>

            {(t.third_party_economics||[]).length>0 && (
              <div style={{marginTop:8}}>
                <h3 style={{fontSize:16}}>Condiciones económicas</h3>
                {(t.third_party_economics||[]).map((e:any, i:number)=>(
                  <div key={i} className="row" style={{gap:8}}>
                    <div className="badge" style={{flex:'0 0 240px'}}>{e.category}</div>
                    <div><strong>%:</strong> {e.third_pct}</div>
                    <div><strong>Base:</strong> {e.third_base==='net'?'Neto':'Bruto'}</div>
                    <div><strong>Ámbito:</strong> {e.base_scope}</div>
                    {(e.third_exempt_value||0)>0 && (
                      <div><strong>Exento:</strong> {e.third_exempt_type==='percent' ? `${e.third_exempt_value}%` : `${e.third_exempt_value}€`}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {Array.isArray(contractsByThird[t.id]) && contractsByThird[t.id].length>0 && (
              <div style={{marginTop:8}}>
                <h3 style={{fontSize:16}}>Contratos</h3>
                {contractsByThird[t.id].map((c:any)=>(
                  <div key={c.id} className="row" style={{gap:8}}>
                    <div style={{flex:'0 0 260px'}}>{c.name}</div>
                    <div>Firma: {c.signed_at}</div>
                    {c.is_active && <span className="tag tag-green">En Vigor</span>}
                    <a className="btn" href={c.file_url} target="_blank" rel="noreferrer">Descargar PDF</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="module">
        <h2>Contratos (artista)</h2>
        {(artistContracts||[]).length===0 && <div>No hay contratos.</div>}
        {(artistContracts||[]).map((c:any)=>(
          <div key={c.id} className="row" style={{gap:8}}>
            <div style={{flex:'0 0 260px'}}>{c.name}</div>
            <div>Firma: {c.signed_at}</div>
            {c.is_active && <span className="tag tag-green">En Vigor</span>}
            <a className="btn" href={c.file_url} target="_blank" rel="noreferrer">Descargar PDF</a>
          </div>
        ))}
      </div>
    </Layout>
  )
}
