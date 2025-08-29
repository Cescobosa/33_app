import { useEffect, useState } from 'react'
import Image from 'next/image'
import { supabase } from '../../../lib/supabaseClient'
import Layout from '../../../components/Layout'

type Provider = {
  id: string
  kind: 'third' | 'provider'
  nick: string | null
  name: string | null
  logo_url: string | null
  is_active?: boolean | null
}

export default function ProvidersList() {
  const [items, setItems] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('third_parties')
        .select('id, kind, nick, name, logo_url, is_active')
        .eq('kind', 'provider')
        .order('nick', { ascending: true })
      if (error) setError(error.message)
      else setItems((data || []).filter(p => p.is_active !== false))
      setLoading(false)
    })()
  }, [])

  return (
    <Layout>
      <h1>Proveedores</h1>

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
          {items.map((p) => {
            const title = p.nick || p.name || 'Sin nombre'
            return (
              <a
                key={p.id}
                href={`/partners/providers/${p.id}`}
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
                  {p.logo_url ? (
                    <Image src={p.logo_url} alt={title} fill style={{ objectFit: 'cover' }} />
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
