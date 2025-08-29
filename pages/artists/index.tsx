import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'

type Artist = {
  id: string
  stage_name: string
  photo_url: string | null
  is_archived?: boolean | null
}

export default function ArtistsList() {
  const [items, setItems] = useState<Artist[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      setError(null)
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
      <h1>Artistas</h1>

      {loading && <div className="module">Cargando…</div>}
      {error && <div className="module" style={{color:'#d42842'}}>Error: {error}</div>}

      {!loading && !error && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
            }}
          >
            {items.map((a) => (
              <a
                key={a.id}
                href={`/artists/${a.id}`}
                className="card"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12 }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    position: 'relative',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#f3f4f6',
                    flex: '0 0 auto',
                  }}
                >
                  {a.photo_url ? (
                    <Image src={a.photo_url} alt={a.stage_name} fill style={{ objectFit: 'cover' }} />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#9ca3af',
                        fontSize: 12,
                      }}
                    >
                      Sin foto
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 600 }}>{a.stage_name}</div>
              </a>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <a className="btn" href="/artists/new">
              + Crear artista
            </a>
          </div>
        </>
      )}
    </Layout>
  )
}
