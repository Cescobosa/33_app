import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Nav from '../../components/Nav'

type Artist = {
  id: string
  stage_name: string
  full_name: string | null
  dni: string | null
  birth_date: string | null
  is_group: boolean
  contract_type: string | null
  photo_url: string | null
}

export default function ArtistsList() {
  const [artists, setArtists] = useState<Artist[]>([])

  const load = async () => {
    const { data, error } = await supabase.from('artists').select('*').order('stage_name')
    if (error) alert(error.message); else setArtists(data ?? [])
  }

  useEffect(()=>{ load() }, [])

  return (
    <div className="container">
      <Nav/>
      <h1>Artistas</h1>
      <div className="grid">
        {artists.map(a => (
          <div key={a.id} className="card">
            {a.photo_url ? <img className="thumb" src={a.photo_url} alt="foto"/> : <div className="badge">sin foto</div>}
            <div style={{fontWeight:700, fontSize:18}}>{a.stage_name}</div>
            <small>{a.full_name ?? ''}</small><br/>
            <small>{a.contract_type}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
