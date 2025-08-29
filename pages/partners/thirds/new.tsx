import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import Layout from '../../../components/Layout'

const BUCKET_LOGOS = 'artist-photos'

type Kind = 'third'
type PersonaRef = { full_name: string; role: string; email: string; phone: string }

type Mode = 'particular' | 'empresa'

type SearchHit = {
  id: string
  kind: 'third' | 'provider'
  nick: string | null
  name: string | null
  logo_url: string | null
  tax_id: string | null
  email: string | null
}

export default function NewThird() {
  const router = useRouter()

  // Paso 1: tipo fiscal
  const [mode, setMode] = useState<Mode>('particular')

  // Cabecera
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [nick, setNick] = useState('')

  // Particular
  const [pFullName, setPFullName] = useState('')
  const [pDni, setPDni] = useState('')

  // Empresa (fiscal)
  const [eCompanyName, setECompanyName] = useState('')
  const [eCif, setECif] = useState('')

  // Contacto (común)
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // Empresa → personas de referencia (múltiples)
  const [persons, setPersons] = useState<PersonaRef[]>([])

  // Autocompletar / duplicados
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [checkingDup, setCheckingDup] = useState(false)

  useEffect(() => {
    if (logoFile) setLogoPreview(URL.createObjectURL(logoFile))
    else setLogoPreview(null)
  }, [logoFile])

  // Autocompletar por nick / name
  useEffect(() => {
    const term = q.trim()
    if (!term) { setHits([]); return }
    const run = async () => {
      const { data, error } = await supabase
        .from('third_parties')
        .select('id,kind,nick,name,logo_url,tax_id,email')
        .or(`nick.ilike.%${term}%,name.ilike.%${term}%`)
        .order('nick', { ascending: true })
        .limit(8)
      if (!error) setHits((data || []) as SearchHit[])
    }
    const t = setTimeout(run, 200)
    return () => clearTimeout(t)
  }, [q])

  const title = useMemo(() => {
    if (mode === 'particular') return pFullName || nick || 'Nuevo tercero'
    return eCompanyName || nick || 'Nuevo tercero'
  }, [mode, pFullName, eCompanyName, nick])

  const nameForDB = useMemo(() => {
    return mode === 'particular' ? (pFullName || nick) : (eCompanyName || nick)
  }, [mode, pFullName, eCompanyName, nick])

  const taxIdForDB = useMemo(() => {
    return mode === 'particular' ? (pDni || null) : (eCif || null)
  }, [mode, pDni, eCif])

  async function uploadAndSign(bucket: string, file: File) {
    const safeName = file.name.normalize('NFC')
    const name = `${Date.now()}-${safeName}`
    const { error: upErr } = await supabase.storage.from(bucket).upload(name, file)
    if (upErr) throw upErr
    const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(name, 60 * 60 * 24 * 365)
    if (signErr || !data) throw signErr || new Error('No signed URL')
    return data.signedUrl
  }

  const validate = () => {
    if (!nick.trim()) return 'Pon un Nick (alias corto).'
    if (!nameForDB?.trim()) return mode === 'particular' ? 'Pon el nombre completo.' : 'Pon el nombre de la empresa.'
    if (!email.trim() && !phone.trim()) return 'Pon al menos un dato de contacto (email o teléfono).'
    return null
  }

  const findDuplicates = async () => {
    const or: string[] = []
    const term = (nameForDB || '').trim()
    if (term) or.push(`nick.ilike.${term}`, `name.ilike.${term}`)
    const filters: string[] = []
    if (taxIdForDB) filters.push(`tax_id.eq.${taxIdForDB}`)
    if (email) filters.push(`email.ilike.${email}`)

    let query = supabase.from('third_parties').select('id,kind,nick,name,logo_url,tax_id,email').eq('kind', 'third')
    if (or.length) query = query.or(or.join(','))
    if (filters.length) {
      for (const f of filters) query = query.or(f)
    }
    const { data, error } = await query.limit(5)
    if (error) throw error

    const list = (data || []).filter(Boolean)
    const matches = list.filter(row => {
      const sameName = term && ((row.nick || '').toLowerCase() === term.toLowerCase() || (row.name || '').toLowerCase() === term.toLowerCase())
      const sameTax = taxIdForDB && row.tax_id && row.tax_id.toLowerCase() === taxIdForDB.toLowerCase()
      const sameEmail = email && row.email && row.email.toLowerCase() === email.toLowerCase()
      return sameName || sameTax || sameEmail
    })
    return matches
  }

  const onSubmit = async () => {
    const err = validate()
    if (err) return alert(err)
    try {
      setCheckingDup(true)
      const dups = await findDuplicates()
      setCheckingDup(false)
      if (dups.length > 0) {
        const first = dups[0]
        const label = first.nick || first.name || 'el existente'
        const go = confirm(`Ya existe un tercero con datos coincidentes: "${label}".\n\n¿Quieres abrir su ficha en lugar de crear duplicado?`)
        if (go) {
          return router.push(`/partners/thirds/${first.id}`)
        } else {
          return alert('No se permite crear duplicados. Ajusta los datos o selecciona el existente.')
        }
      }

      let logo_url: string | null = null
      if (logoFile) logo_url = await uploadAndSign(BUCKET_LOGOS, logoFile)

      const { data: inserted, error: insErr } = await supabase
        .from('third_parties')
        .insert({
          kind: 'third' as Kind,
          nick: nick || null,
          name: nameForDB || null,
          tax_id: taxIdForDB || null,
          email: email || null,
          phone: phone || null,
          logo_url,
          is_active: true
        })
        .select('id')
        .single()
      if (insErr) throw insErr

      if (mode === 'empresa' && persons.length > 0) {
        try {
          for (const p of persons) {
            if ((p.full_name || '').trim()) {
              await supabase.from('third_party_contacts').insert({
                third_party_id: inserted.id,
                full_name: p.full_name,
                role: p.role || null,
                email: p.email || null,
                phone: p.phone || null
              })
            }
          }
        } catch {
          console.warn('Tabla third_party_contacts no disponible; contactos no guardados.')
        }
      }

      alert('Tercero creado.')
      router.push(`/partners/thirds/${inserted.id}`)
    } catch (e: any) {
      setCheckingDup(false)
      alert(e.message || 'Error al crear tercero')
    }
  }

  // Helpers UI
  const addPerson = () => setPersons(prev => [...prev, { full_name: '', role: '', email: '', phone: '' }])
  const updPerson = (i: number, k: keyof PersonaRef, v: string) => {
    const c = [...persons]; (c[i] as any)[k] = v; setPersons(c)
  }
  const rmPerson = (i: number) => setPersons(prev => prev.filter((_, idx) => idx !== i))

  return (
    <Layout>
      <h1>Nuevo tercero</h1>

      {/* Autocompletar / Buscar existentes por Nick/Nombre */}
      <div className="module">
        <h2>Buscar existente</h2>
        <div className="row" style={{ gap: 8 }}>
          <input
            placeholder="Buscar por Nick o Nombre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        {hits.length > 0 && (
          <div className="card" style={{ marginTop: 8 }}>
            {hits.map((h) => {
              const label = h.nick || h.name || '(sin nombre)'
              return (
                <a
                  key={h.id}
                  className="row"
                  style={{ alignItems: 'center', gap: 12, padding: '6px 0' }}
                  href={`/partners/${h.kind === 'provider' ? 'providers' : 'thirds'}/${h.id}`}
                >
                  <div style={{ width: 32, height: 32, position: 'relative', borderRadius: 6, overflow: 'hidden', background: '#f3f4f6' }}>
                    {h.logo_url ? <Image src={h.logo_url} alt={label} fill style={{ objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ fontWeight: 600 }}>{label}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>{h.kind === 'provider' ? 'Proveedor' : 'Tercero'}</div>
                </a>
              )
            })}
          </div>
        )}
      </div>

      {/* Tipo fiscal */}
      <div className="module">
        <h2>Tipo</h2>
        <div className="row" style={{ gap: 12 }}>
          <label><input type="radio" checked={mode === 'particular'} onChange={() => setMode('particular')} /> Particular</label>
          <label><input type="radio" checked={mode === 'empresa'} onChange={() => setMode('empresa')} /> Empresa</label>
        </div>
      </div>

      {/* Cabecera: Logo + Nick */}
      <div className="module">
        <h2>Cabecera</h2>
        <div className="row" style={{ gap: 12, alignItems: 'center' }}>
          <div style={{ width: 88, height: 88, position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#f3f4f6' }}>
            {logoPreview ? <Image src={logoPreview} alt="Logo" fill style={{ objectFit: 'cover' }} /> : null}
          </div>
          <div>
            <label>Logo / Foto</label>
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
          </div>
          <div style={{ flex: '1 1 260px' }}>
            <label>Nick (alias)</label>
            <input value={nick} onChange={(e) => setNick(e.target.value)} placeholder="Ej. PromoMax / JuanPérez" />
          </div>
        </div>
      </div>

      {/* Particular → Datos personales */}
      {mode === 'particular' && (
        <div className="module">
          <h2>Datos personales</h2>
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: '1 1 340px' }}>
              <label>Nombre completo</label>
              <input value={pFullName} onChange={(e) => setPFullName(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label>DNI / NIF</label>
              <input value={pDni} onChange={(e) => setPDni(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Empresa → Datos fiscales */}
      {mode === 'empresa' && (
        <div className="module">
          <h2>Datos fiscales</h2>
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: '1 1 340px' }}>
              <label>Nombre fiscal / Empresa</label>
              <input value={eCompanyName} onChange={(e) => setECompanyName(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <label>NIF / CIF</label>
              <input value={eCif} onChange={(e) => setECif(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Contacto (común) + Personas de referencia si empresa */}
      <div className="module">
        <h2>Contacto</h2>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: '1 1 260px' }}>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label>Teléfono</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>

        {mode === 'empresa' && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Personas de referencia</h3>
            <button onClick={addPerson}>+ Añadir persona</button>
            {persons.map((p, i) => (
              <div key={i} className="row" style={{ gap: 8, marginTop: 8 }}>
                <div style={{ flex: '1 1 240px' }}>
                  <label>Nombre completo</label>
                  <input value={p.full_name} onChange={(e) => updPerson(i, 'full_name', e.target.value)} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label>Cargo</label>
                  <input value={p.role} onChange={(e) => updPerson(i, 'role', e.target.value)} />
                </div>
                <div style={{ flex: '1 1 240px' }}>
                  <label>Email</label>
                  <input value={p.email} onChange={(e) => updPerson(i, 'email', e.target.value)} />
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label>Teléfono</label>
                  <input value={p.phone} onChange={(e) => updPerson(i, 'phone', e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={() => rmPerson(i)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="module">
        <button onClick={onSubmit} disabled={checkingDup}>
          {checkingDup ? 'Comprobando…' : 'Crear tercero'}
        </button>
      </div>
    </Layout>
  )
}
