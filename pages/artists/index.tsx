import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import Nav from '../../components/Nav'

type Artist = {
  id: string
  stage_name: string
  full_name: string | null
  contract_type: string | null
  photo_url: string | null
}

export default function ArtistsList() {
  const [artists, setArtists] = useState<Artist[]>([])

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('artists').select('id,stage_name,full_name,contract_type,photo_url').order('stage_name')
      if (error) alert(error.message); else setArtists(data ?? [])
    })()
  }, [])

  return (
    <div className="container">
      <Nav/>
      <h1>Artistas</h1>
      <div className="grid">
        {artists.map(a => (
          <Link key={a.id} href={`/artists/${a.id}`} className="card" style={{display:'block', color:'inherit'}}>
            {a.photo_url ? <img className="thumb" src={a.photo_url} alt="foto"/> : <div className="badge">sin foto</div>}
            <div style={{fontWeight:700, fontSize:18}}>{a.stage_name}</div>
            <small>{a.full_name ?? ''}</small><br/>
            <small>{a.contract_type}</small>
          </Link>
        ))}
      </div>
    </div>
  )
}
