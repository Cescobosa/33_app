import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '../../../lib/supabaseClient'
import Layout from '../../../components/Layout'

type Third = {
  id: string
  kind: 'third' | 'provider'
  nick: string | null
  name: string | null
  logo_url: string | null
  is_active?: boolean | null
}

export default function ThirdsList() {
  const [items, setItems] = useState<Third[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('third_parties')
        .select('id, kind, nick, name, logo_url, is_active')
        .eq('kind', 'third')
        .order('nick', { ascending: true })
      if (error) setError(error.message)
      else setItems((data || []).filter(t => t.is_active !== false))
      setLoading(false)
    })()
  }, [])

  return (
    <Layout>
      <h1>Terceros</h1>

      {loading && <div className="module">Cargando…</div>}
      {error && <div className="module" style={{color:'#d42842'}}>Error: {error}</div>}

      {!loading && !error && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          {items.map((t) => {
            const title = t.nick || t.name || 'Sin nombre'
            return (
              <a
                key={t.id}
                href={`/partners/thirds/${t.id}`}
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
                  {t.logo_url ? (
                    <Image src={t.logo_url} alt={title} fill style={{ objectFit: 'cover' }} />
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
                      Sin logo
                    </div>
                  )}
                </div>
                <div style={{ fontWeight: 600 }}>{title}</div>
              </a>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
