import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'
import Button from '../../components/ui/Button'

type Artist = { id: string; stage_name: string; photo_url: string | null; is_archived?: boolean | null }

export default function ArtistsList() {
  const [items, setItems] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('artists')
        .select('id, stage_name, photo_url, is_archived')
        .order('stage_name', { ascending: true })
      if (error) setError(error.message)
      else setItems((data || []).filter(a => !a.is_archived))
      setLoading(false)
    })()
  }, [])

  return (
    <Layout>
      <div className="row" style={{ alignItems:'center', justifyContent:'space-between', marginBottom: 10 }}>
        <h1>Artistas</h1>
        <Button as="a" href="/artists/new" icon="plus">Crear artista</Button>
      </div>

      {loading && <div className="module">Cargando…</div>}
      {error && <div className="module" style={{color:'#d42842'}}>Error: {error}</div>}

      {!loading && !error && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
          {items.map(a => (
            <a key={a.id} href={`/artists/${a.id}`} className="card" style={{ display:'flex', alignItems:'center', gap:12, padding:12 }}>
              <img src={a.photo_url || ''} alt="" style={{ width:56, height:56, borderRadius:12, objectFit:'cover', background:'#f3f4f6' }}/>
              <div style={{ fontWeight:600 }}>{a.stage_name}</div>
            </a>
          ))}
        </div>
      )}
    </Layout>
  )
}
