import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import Layout from '../../../components/Layout'
import HeaderCard from '../../../components/HeaderCard'

export default function ThirdView() {
  const router = useRouter()
  const { id } = router.query as { id: string }

  const [third, setThird] = useState<any>(null)
  const [econ, setEcon] = useState<any[]>([])
  const [contracts, setContracts] = useState<any[]>([])
  const [artists, setArtists] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string|null>(null)

  useEffect(()=>{
    if(!id) return
    ;(async()=>{
      setLoading(true); setErr(null)
      try {
        const { data: t, error: e1 } = await supabase.from('third_parties').select('*').eq('id', id).single()
        if (e1) throw e1
        setThird(t)

        const [{ data: ec }, { data: ct }] = await Promise.all([
          supabase.from('third_party_economics').select('*').eq('third_party_id', id),
          supabase.from('third_party_contracts').select('*').eq('third_party_id', id).order('signed_at', { ascending: false }),
        ])
        setEcon(ec||[])
        setContracts(ct||[])

        // cargar artistas referenciados
        const artistIds = Array.from(new Set([...(ec||[]).map((x:any)=>x.artist_id), ...(ct||[]).map((x:any)=>x.artist_id)]))
        if (artistIds.length) {
          const { data: arts } = await supabase.from('artists').select('id,stage_name,photo_url').in('id', artistIds)
          setArtists(Object.fromEntries((arts||[]).map((a:any)=>[a.id,a])))
        }
      } catch(e:any) {
        setErr(e.message||'Error')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  // Agrupar por artista
  const grouped = useMemo(()=>{
    const map: Record<string, { artist:any, econ:any[], contracts:any[] }> = {}
    for (const e of econ) {
      const a = artists[e.artist_id]; if (!a) continue
      map[e.artist_id] = map[e.artist_id] || { artist:a, econ:[], contracts:[] }
      map[e.artist_id].econ.push(e)
    }
    for (const c of contracts) {
      const a = artists[c.artist_id]; if (!a) continue
      map[c.artist_id] = map[c.artist_id] || { artist:a, econ:[], contracts:[] }
      map[c.artist_id].contracts.push(c)
    }
    return Object.values(map).sort((A,B)=> (A.artist.stage_name||'').localeCompare(B.artist.stage_name||''))
  }, [econ, contracts, artists])

  if (loading) return <Layout><div className="module">Cargando…</div></Layout>
  if (err || !third) return <Layout><div className="module" style={{color:'#d42842'}}>Error: {err||'No encontrado'}</div></Layout>

  return (
    <Layout>
      <HeaderCard photoUrl={third.logo_url} title={third.nick || third.name || 'Tercero'} />
      <div className="module">
        <h2>Vinculaciones</h2>
        {grouped.length===0 && <div>No hay vinculaciones.</div>}
        {grouped.map(({ artist, econ, contracts })=>(
          <div key={artist.id} className="card" style={{marginBottom:12}}>
            <div className="row" style={{alignItems:'center', gap:12}}>
              <img src={artist.photo_url||''} alt="" style={{width:40,height:40,borderRadius:8,objectFit:'cover',background:'#f3f4f6'}}/>
              <a href={`/artists/${artist.id}`} style={{fontWeight:600}}>{artist.stage_name}</a>
            </div>

            {econ.length>0 && (
              <div style={{marginTop:8}}>
                <h3 style={{fontSize:16}}>Condiciones económicas</h3>
                {econ.map((e:any,i:number)=>(
                  <div key={i} className="row" style={{gap:8}}>
                    <div className="badge" style={{flex:'0 0 240px'}}>{e.category}</div>
                    <div>%: {e.third_pct}</div>
                    <div>Base: {e.third_base==='net'?'Neto':'Bruto'}</div>
                    <div>Ámbito: {e.base_scope}</div>
                    {(e.third_exempt_value||0)>0 && (
                      <div>Exento: {e.third_exempt_type==='percent' ? `${e.third_exempt_value}%` : `${e.third_exempt_value}€`}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {contracts.length>0 && (
              <div style={{marginTop:8}}>
                <h3 style={{fontSize:16}}>Contratos</h3>
                {contracts.map((c:any)=>(
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
    </Layout>
  )
}
