import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Button from './ui/Button'

type Party = {
  id: string
  kind: 'third' | 'provider'
  nick: string | null
  name: string | null
  tax_id: string | null
  email: string | null
  logo_url: string | null
}

type Props = {
  kind: 'third' | 'provider'
  label?: string
  placeholder?: string
  onSelect: (party: Party) => void
  inlineCreateHref?: string // e.g. "/partners/thirds/new" (se abrirá en otra pestaña)
}

export default function SmartPartySelect({ kind, label='Buscar', placeholder='Escribe nombre o nick…', onSelect, inlineCreateHref }: Props) {
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Party[]>([])
  const [warning, setWarning] = useState<Party | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!q.trim()) { setItems([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('third_parties')
        .select('id, kind, nick, name, tax_id, email, logo_url')
        .eq('kind', kind)
        .or(`nick.ilike.%${q}%,name.ilike.%${q}%`)
        .limit(10)
      setItems(data || [])
      setLoading(false)
    }, 200)
    return () => clearTimeout(t)
  }, [q, kind])

  // alerta de duplicado si coincide exactamente Nick/Nombre o TaxId/email
  const checkDuplicate = async (value: string) => {
    const { data } = await supabase
      .from('third_parties')
      .select('id, kind, nick, name, tax_id, email, logo_url')
      .eq('kind', kind)
      .or(`nick.ilike.${value},name.ilike.${value},tax_id.ilike.${value},email.ilike.${value}`)
      .limit(1)
    setWarning((data && data[0]) || null)
  }

  useEffect(() => {
    const v = q.trim()
    if (!v) { setWarning(null); return }
    const t = setTimeout(() => checkDuplicate(v), 400)
    return () => clearTimeout(t)
  }, [q])

  const list = useMemo(() => items, [items])

  return (
    <div ref={boxRef} className="card" style={{ padding: 12 }}>
      <label style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</label>
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%' }}
      />
      {loading && <div style={{ marginTop: 8, fontSize: 12 }}>Buscando…</div>}

      {/* Sugerencias */}
      {list.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {list.map(p => (
            <div key={p.id} className="row" style={{ alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid #f3f4f6' }}>
              <img src={p.logo_url || ''} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', background: '#f3f4f6' }}/>
              <div style={{ flex: '1 1 auto' }}>
                <div style={{ fontWeight: 600 }}>{p.nick || p.name}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{p.tax_id || p.email || '—'}</div>
              </div>
              <Button tone="ghost" icon="link" onClick={() => onSelect(p)}>Seleccionar</Button>
            </div>
          ))}
        </div>
      )}

      {/* Crear nuevo */}
     <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
      {inlineCreateHref && (
        <a href={inlineCreateHref} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
          {/* No pases target/href/rel al Button: van en el <a> */}
          <Button icon="plus">
            Crear nuevo {kind === 'third' ? 'tercero' : 'proveedor'}
          </Button>
        </a>
      )}
    </div>

      {/* Advertencia de duplicado */}
      {warning && (
        <div className="card" style={{ marginTop: 10, border: '1px solid #fde68a', background: '#fffbeb' }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Posible duplicado</div>
          <div className="row" style={{ alignItems: 'center', gap: 10 }}>
            <img src={warning.logo_url || ''} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', background: '#f3f4f6' }}/>
            <div style={{ flex: '1 1 auto' }}>
              Ya existe: <strong>{warning.nick || warning.name}</strong>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{warning.tax_id || warning.email || '—'}</div>
            </div>
            <Button tone="ghost" icon="link" onClick={() => onSelect(warning!)}>Usar este</Button>
          </div>
        </div>
      )}
    </div>
  )
}
