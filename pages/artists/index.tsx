import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import Nav from '../../components/Nav'

type Artist = {
  id: string
  stage_name: string
  full_name: string | null
  contract_type: string | null
  photo_url: string | null
  is_archived: boolean
}

export default function ArtistsList() {
  const router = useRouter()
  const archived = router.query.archived === '1'
  const [artists, setArtists] = useState<Artist[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('artists')
      .select('id,stage_name,full_name,contract_type,photo_url,is_archived')
      .eq('is_archived', archived)
      .order('stage_name')
    if (error) alert(error.message); else setArtists(data ?? [])
    setLoading(false)
  }

  useEffect(()=>{ load() }, [archived])

  const setArchived = async (id:string, value:boolean) => {
    const { error } = await supabase.from('artists').update({ is_archived: value }).eq('id', id)
    if (error) return alert(error.message)
    load()
  }

  return (
    <div className="container">
      <Nav/>
      <div className="row" style={{alignItems:'center'}}>
        <h1 style={{marginRight:12}}>Artistas {archived ? '(Archivados)' : ''}</h1>
        <Link className="badge" href={archived ? '/artists' : '/artists?archived=1'}>
          {archived ? 'Ver activos' : 'Ver archivados'}
        </Link>
      </div>

      {loading ? <div className="card">Cargando…</div> : (
        <div className="grid">
          {artists.map(a => (
            <div key={a.id} className="card">
              <Link href={`/artists/${a.id}`} style={{display:'block', color:'inherit'}}>
                {a.photo_url ? <img className="thumb" src={a.photo_url} alt="foto"/> : <div className="badge">sin foto</div>}
                <div style={{fontWeight:700, fontSize:18}}>{a.stage_name}</div>
                {a.full_name ? <small>{a.full_name}</small> : null}<br/>
                {a.contract_type ? <small>{a.contract_type}</small> : null}
              </Link>
              <div style={{marginTop:8}}>
                {archived ? (
                  <button onClick={()=>setArchived(a.id,false)}>Recuperar</button>
                ) : (
                  <button onClick={()=>setArchived(a.id,true)}>Archivar</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
