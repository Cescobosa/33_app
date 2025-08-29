// pages/artists/new.tsx
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'

const BUCKET_PHOTOS = 'artist-photos'
const BUCKET_CONTRACTS = 'contracts'

type EconRow = {
  category: string
  artist_pct: number
  office_pct: number
  artist_base: 'gross' | 'net'
  office_base: 'gross' | 'net'
  office_exempt_type: 'amount' | 'percent'
  office_exempt_value: number
  brands_mode?: 'office_only' | 'split' // solo aplica en "Acciones con marcas"
}

const GENERAL_CATEGORIES = [
  'Conciertos a caché',
  'Conciertos a empresa',
  'Royalties Discográficos',
  'Editorial',
  'Merchandising',
  'Acciones con marcas',
  'Otras acciones',
]

function validateIBAN(iban: string): boolean {
  const s = iban.replace(/\s+/g, '').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{9,30}$/.test(s)) return false
  const rearr = s.slice(4) + s.slice(0, 4)
  const converted = rearr.replace(/[A-Z]/g, (ch) => (ch.charCodeAt(0) - 55).toString())
  let remainder = 0
  for (let i = 0; i < converted.length; i += 7) {
    const part = remainder.toString() + converted.substr(i, 7)
    remainder = parseInt(part, 10) % 97
  }
  return remainder === 1
}
const pctOK = (n: number) => n >= 0 && n <= 100

export default function NewArtist() {
  // archivos
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [contractFile, setContractFile] = useState<File | null>(null)

  // básicos
  const [stageName, setStageName] = useState('')
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [isGroup, setIsGroup] = useState(false)

  // contrato: General / Booking
  const [contractType, setContractType] = useState<'General' | 'Booking'>('General')

  // fiscales
  const [taxType, setTaxType] = useState<'particular' | 'empresa'>('particular')
  const [taxName, setTaxName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [iban, setIban] = useState('')

  // miembros
  const [members, setMembers] = useState<{ full_name: string; dni: string }[]>([])

  // GENERAL
  const makeEmptyGeneral = (): EconRow[] =>
    GENERAL_CATEGORIES.map((c) => ({
      category: c,
      artist_pct: 0,
      office_pct: 0,
      artist_base: 'gross',
      office_base: 'gross',
      office_exempt_type: 'amount',
      office_exempt_value: 0,
      brands_mode: c === 'Acciones con marcas' ? 'split' : undefined,
    }))
  const [econGeneral, setEconGeneral] = useState<EconRow[]>(makeEmptyGeneral())

  // BOOKING
  const [bookingOfficePct, setBookingOfficePct] = useState(0)
  const [bookingOfficeBase, setBookingOfficeBase] = useState<'gross' | 'net'>('gross')
  const [bookingExemptType, setBookingExemptType] = useState<'amount' | 'percent'>('amount')
  const [bookingExemptValue, setBookingExemptValue] = useState(0)

  // terceros
  type ThirdEcon = {
    category: string
    third_pct: number
    third_base: 'gross' | 'net'
    base_scope: 'total' | 'office' | 'artist'
    third_exempt_type: 'amount' | 'percent'
    third_exempt_value: number
  }
  type Third = {
    nick: string
    name: string
    tax_id: string
    email: string
    phone: string
    logo_file?: File | null
    logo_url?: string | null
    contract_file?: File | null
    contract_url?: string | null
    is_active: boolean
    econ: ThirdEcon[]
  }
  const [thirds, setThirds] = useState<Third[]>([])

  useEffect(() => {
    if (taxType === 'particular') {
      setTaxName(fullName)
      setTaxId(dni)
    }
  }, [taxType, fullName, dni])

  const addMember = () => setMembers((m) => [...m, { full_name: '', dni: '' }])
  const updateMember = (i: number, k: 'full_name' | 'dni', v: string) => {
    const copy = [...members]
    ;(copy[i] as any)[k] = v
    setMembers(copy)
  }
  const removeMember = (i: number) => setMembers((m) => m.filter((_, idx) => idx !== i))

  const addThird = () =>
    setThirds((t) => [
      ...t,
      {
        nick: '',
        name: '',
        tax_id: '',
        email: '',
        phone: '',
        logo_file: null,
        logo_url: null,
        contract_file: null,
        contract_url: null,
        is_active: true,
        econ:
          contractType === 'Booking'
            ? [
                {
                  category: 'Booking',
                  third_pct: 0,
                  third_base: 'gross',
                  base_scope: 'total',
                  third_exempt_type: 'amount',
                  third_exempt_value: 0,
                },
              ]
            : GENERAL_CATEGORIES.map((c) => ({
                category: c,
                third_pct: 0,
                third_base: 'gross',
                base_scope: 'total',
                third_exempt_type: 'amount',
                third_exempt_value: 0,
              })),
      },
    ])
  const updateThirdField = (i: number, k: keyof Third, v: any) => {
    const copy = [...thirds]
    ;(copy[i] as any)[k] = v
    setThirds(copy)
  }
  const updateThirdEcon = (ti: number, ci: number, k: keyof ThirdEcon, v: any) => {
    const copy = [...thirds]
    ;(copy[ti].econ[ci] as any)[k] = v
    setThirds(copy)
  }
  const removeThird = (i: number) => setThirds((t) => t.filter((_, idx) => idx !== i))

  const handleEconGeneral = (i: number, k: keyof EconRow, v: any) => {
    const copy = [...econGeneral]
    ;(copy[i] as any)[k] = v
    setEconGeneral(copy)
  }

  async function uploadAndSign(bucket: string, file: File): Promise<string> {
    const name = `${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from(bucket).upload(name, file)
    if (upErr) throw upErr
    const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(name, 60 * 60 * 24 * 365)
    if (signErr || !data) throw signErr || new Error('No signed URL')
    return data.signedUrl
  }

  const validateAll = () => {
    if (!stageName.trim()) return 'Pon el nombre artístico.'
    if (!contractFile) return 'Debes adjuntar el contrato del artista.'
    if (iban && !validateIBAN(iban)) return 'IBAN no válido. Introduce el IBAN completo.'
    if (contractType === 'Booking') {
      if (!pctOK(bookingOfficePct)) return '% Oficina (Booking) debe estar entre 0 y 100.'
      if (bookingExemptType === 'percent' && !pctOK(bookingExemptValue)) return 'Exento (%) en Booking debe estar entre 0 y 100.'
    } else {
      for (const row of econGeneral) {
        if (row.category === 'Conciertos a caché') {
          if (!pctOK(row.office_pct)) return 'En Caché, % Oficina debe estar entre 0 y 100.'
          if (row.office_exempt_type === 'percent' && !pctOK(row.office_exempt_value)) return 'Exento (%) en Caché debe estar entre 0 y 100.'
        } else if (row.category === 'Royalties Discográficos') {
          if (!pctOK(row.artist_pct)) return 'En Royalties, % Artista debe estar entre 0 y 100.'
        } else {
          if (!pctOK(row.artist_pct)) return `En ${row.category}, % Artista debe estar entre 0 y 100.`
          if (!pctOK(row.office_pct)) return `En ${row.category}, % Oficina debe estar entre 0 y 100.`
          if (row.office_exempt_type === 'percent' && !pctOK(row.office_exempt_value))
            return `En ${row.category}, Exento (%) debe estar entre 0 y 100.`
        }
      }
    }
    for (const t of thirds) {
      for (const e of t.econ) {
        if (!pctOK(e.third_pct)) return 'En Terceros, % debe estar entre 0 y 100.'
        if (e.third_exempt_type === 'percent' && !pctOK(e.third_exempt_value)) return 'En Terceros, Exento (%) debe estar entre 0 y 100.'
      }
    }
    return null
  }

  const onSubmit = async () => {
    const msg = validateAll()
    if (msg) return alert(msg)
    try {
      const photo_url = photoFile ? await uploadAndSign(BUCKET_PHOTOS, photoFile) : null
      const contract_url = await uploadAndSign(BUCKET_CONTRACTS, contractFile!)

      const { data: artist, error: aerr } = await supabase
        .from('artists')
        .insert({
          stage_name: stageName,
          full_name: fullName || null,
          dni: dni || null,
          birth_date: birthDate || null,
          is_group: isGroup,
          contract_type: contractType,
          photo_url,
          tax_type: taxType,
          tax_name: taxName || null,
          tax_id: taxId || null,
          iban: iban || null,
          contract_url,
        })
        .select('*')
        .single()
      if (aerr) throw aerr

      for (const m of members) {
        if (m.full_name) {
          const { error } = await supabase
            .from('artist_members')
            .insert({ artist_id: artist.id, full_name: m.full_name, dni: m.dni || null })
          if (error) throw error
        }
      }

      if (contractType === 'Booking') {
        const { error } = await supabase.from('artist_economics').insert({
          artist_id: artist.id,
          category: 'Booking',
          artist_pct: 0,
          office_pct: bookingOfficePct,
          artist_base: 'gross',
          office_base: bookingOfficeBase,
          office_exempt_type: bookingExemptType,
          office_exempt_value: bookingExemptValue,
        })
        if (error) throw error
      } else {
        for (const e of econGeneral) {
          const row = { ...e }
          if (row.category === 'Conciertos a caché') row.artist_pct = 0
          if (row.category === 'Royalties Discográficos') {
            row.office_pct = 0
            row.office_base = 'gross'
            row.office_exempt_type = 'amount'
            row.office_exempt_value = 0
          }
          const payload: any = {
            artist_id: artist.id,
            category: row.category,
            artist_pct: row.artist_pct,
            office_pct: row.office_pct,
            artist_base: row.artist_base,
            office_base: row.office_base,
            office_exempt_type: row.office_exempt_type,
            office_exempt_value: row.office_exempt_value,
          }
          if (row.category === 'Acciones con marcas') payload.brands_mode = row.brands_mode
          const { error } = await supabase.from('artist_economics').insert(payload)
          if (error) throw error
        }
      }

      for (const t of thirds) {
        let logo_url: string | null = null
        let t_contract_url: string | null = null
        if (t.logo_file) logo_url = await uploadAndSign(BUCKET_PHOTOS, t.logo_file)
        if (t.contract_file) t_contract_url = await uploadAndSign(BUCKET_CONTRACTS, t.contract_file)
        const { data: tp, error } = await supabase
          .from('third_parties')
          .insert({
            artist_id: artist.id,
            nick: t.nick,
            name: t.name,
            tax_id: t.tax_id || null,
            email: t.email || null,
            phone: t.phone || null,
            logo_url,
            contract_url: t_contract_url,
            is_active: t.is_active,
          })
          .select('*')
          .single()
        if (error) throw error
        for (const ec of t.econ) {
          const { error: e2 } = await supabase.from('third_party_economics').insert({
            third_party_id: tp.id,
            category: ec.category,
            third_pct: ec.third_pct,
            third_base: ec.third_base,
            base_scope: ec.base_scope,
            third_exempt_type: ec.third_exempt_type,
            third_exempt_value: ec.third_exempt_value,
          })
          if (e2) throw e2
        }
      }

      alert('Artista creado con éxito.')
      window.location.href = '/artists'
    } catch (e: any) {
      alert(e.message || 'Error guardando artista')
    }
  }

  const econRowUI = (e: EconRow, i: number) => {
    const isCache = e.category === 'Conciertos a caché'
    const isRoy = e.category === 'Royalties Discográficos'
    const isBrand = e.category === 'Acciones con marcas'
    return (
      <div key={i} className="row" style={{ borderTop: '1px solid #1f2937', paddingTop: 12, marginTop: 12 }}>
        <div style={{ flex: '1 1 220px' }}>
          <div className="badge">{e.category}</div>
        </div>

        {isBrand && (
          <div style={{ flex: '1 1 220px' }}>
            <label>Modo</label>
            <select value={e.brands_mode ?? 'split'} onChange={(v) => handleEconGeneral(i, 'brands_mode', v.target.value as any)}>
              <option value="office_only">Comisión de oficina</option>
              <option value="split">Reparto porcentajes</option>
            </select>
          </div>
        )}

        {/* % Artista */}
        {!isCache && !isRoy && !(isBrand && e.brands_mode === 'office_only') && (
          <div style={{ flex: '1 1 120px' }}>
            <label>% Artista</label>
            <input type="number" value={e.artist_pct} onChange={(v) => handleEconGeneral(i, 'artist_pct', Number(v.target.value))} />
          </div>
        )}
        {isRoy && (
          <>
            <div style={{ flex: '1 1 120px' }}>
              <label>% Artista</label>
              <input type="number" value={e.artist_pct} onChange={(v) => handleEconGeneral(i, 'artist_pct', Number(v.target.value))} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label>Base Artista</label>
              <select value={e.artist_base} onChange={(v) => handleEconGeneral(i, 'artist_base', v.target.value as any)}>
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
          </>
        )}

        {/* % Oficina */}
        {!isRoy && (
          <>
            <div style={{ flex: '1 1 120px' }}>
              <label>% Oficina</label>
              <input type="number" value={e.office_pct} onChange={(v) => handleEconGeneral(i, 'office_pct', Number(v.target.value))} />
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <label>Base Oficina</label>
              <select value={e.office_base} onChange={(v) => handleEconGeneral(i, 'office_base', v.target.value as any)}>
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>Exento (Oficina)</label>
              <div className="row" style={{ gap: 8 }}>
                <select
                  style={{ flex: '0 0 120px' }}
                  value={e.office_exempt_type}
                  onChange={(v) => handleEconGeneral(i, 'office_exempt_type', v.target.value as any)}
                >
                  <option value="amount">Importe</option>
                  <option value="percent">%</option>
                </select>
                <input
                  style={{ flex: '1 1 auto' }}
                  type="number"
                  value={e.office_exempt_value}
                  onChange={(v) => handleEconGeneral(i, 'office_exempt_value', Number(v.target.value))}
                />
              </div>
            </div>
          </>
        )}

        {/* Base artista (cuando aplica) */}
        {!isCache && !isRoy && !(isBrand && e.brands_mode === 'office_only') && (
          <div style={{ flex: '1 1 140px' }}>
            <label>Base Artista</label>
            <select value={e.artist_base} onChange={(v) => handleEconGeneral(i, 'artist_base', v.target.value as any)}>
              <option value="gross">Bruto</option>
              <option value="net">Neto</option>
            </select>
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout>
      <div className="container">
        <h1>Nuevo artista</h1>

        <div className="card">
          <h2>Datos básicos</h2>
          <div className="row">
            <div style={{ flex: '1 1 220px' }}>
              <label>Fotografía</label>
              <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>Nombre artístico</label>
              <input value={stageName} onChange={(e) => setStageName(e.target.value)} placeholder="Ej. El Dobleh" />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label>Nombre completo</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <label>DNI</label>
              <input value={dni} onChange={(e) => setDni(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label>Fecha de nacimiento</label>
              <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label>Tipo de contrato</label>
              <select
                value={contractType}
                onChange={(e) => {
                  setContractType(e.target.value as any)
                  setThirds([])
                }}
              >
                <option value="General">General</option>
                <option value="Booking">Booking</option>
              </select>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12 }}>
            <div style={{ flex: '1 1 160px' }}>
              <label>¿Es grupo?</label>
              <select value={isGroup ? 'sí' : 'no'} onChange={(e) => setIsGroup(e.target.value === 'sí')}>
                <option>no</option>
                <option>sí</option>
              </select>
            </div>
            <div style={{ flex: '1 1 160px' }}>
              <label>Tipo fiscal</label>
              <select value={taxType} onChange={(e) => setTaxType(e.target.value as any)}>
                <option value="particular">Particular</option>
                <option value="empresa">Empresa vinculada</option>
              </select>
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <label>Nombre fiscal / Empresa</label>
              <input value={taxName} onChange={(e) => setTaxName(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label>NIF/CIF</label>
              <input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <label>IBAN</label>
              <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000" />
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Contrato (adjuntar)</h2>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setContractFile(e.target.files?.[0] ?? null)} />
          <small>Obligatorio</small>
        </div>

        {isGroup && (
          <div className="card">
            <h2>Miembros del grupo</h2>
            <button onClick={addMember}>+ Añadir miembro</button>
            {members.map((m, i) => (
              <div key={i} className="row" style={{ marginTop: 8 }}>
                <div style={{ flex: '1 1 300px' }}>
                  <label>Nombre completo</label>
                  <input value={m.full_name} onChange={(e) => updateMember(i, 'full_name', e.target.value)} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label>DNI</label>
                  <input value={m.dni} onChange={(e) => updateMember(i, 'dni', e.target.value)} />
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button onClick={() => removeMember(i)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {contractType === 'Booking' ? (
          <div className="card">
            <h2>Condiciones — Booking</h2>
            <div className="row">
              <div style={{ flex: '1 1 140px' }}>
                <label>% Oficina</label>
                <input type="number" value={bookingOfficePct} onChange={(e) => setBookingOfficePct(Number(e.target.value))} />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label>Base</label>
                <select value={bookingOfficeBase} onChange={(e) => setBookingOfficeBase(e.target.value as any)}>
                  <option value="gross">Bruto</option>
                  <option value="net">Neto</option>
                </select>
              </div>
              <div style={{ flex: '1 1 260px' }}>
                <label>Exento comisión</label>
                <div className="row" style={{ gap: 8 }}>
                  <select
                    style={{ flex: '0 0 120px' }}
                    value={bookingExemptType}
                    onChange={(e) => setBookingExemptType(e.target.value as any)}
                  >
                    <option value="amount">Importe</option>
                    <option value="percent">%</option>
                  </select>
                  <input
                    style={{ flex: '1 1 auto' }}
                    type="number"
                    value={bookingExemptValue}
                    onChange={(e) => setBookingExemptValue(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <h2>Condiciones — General</h2>
            {econGeneral.map((e, i) => econRowUI(e, i))}
            <small>“Caché”: solo % Oficina. “Royalties”: solo % Artista + base. “Marcas”: elige modo en la fila.</small>
          </div>
        )}

        <div className="card" id="thirds">
          <h2>Terceros</h2>
          <button onClick={addThird}>+ Añadir tercero</button>
          {thirds.map((t, ti) => (
            <div key={ti} style={{ borderTop: '1px solid #1f2937', marginTop: 12, paddingTop: 12 }}>
              <div className="row">
                <div style={{ flex: '1 1 200px' }}>
                  <label>Nick</label>
                  <input value={t.nick} onChange={(e) => updateThirdField(ti, 'nick', e.target.value)} />
                </div>
                <div style={{ flex: '1 1 260px' }}>
                  <label>Nombre/Compañía</label>
                  <input value={t.name} onChange={(e) => updateThirdField(ti, 'name', e.target.value)} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label>NIF/CIF</label>
                  <input value={t.tax_id} onChange={(e) => updateThirdField(ti, 'tax_id', e.target.value)} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label>Email liquidaciones</label>
                  <input value={t.email} onChange={(e) => updateThirdField(ti, 'email', e.target.value)} />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label>Teléfono</label>
                  <input value={t.phone} onChange={(e) => updateThirdField(ti, 'phone', e.target.value)} />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <label>Activo</label>
                  <select value={t.is_active ? 'sí' : 'no'} onChange={(e) => updateThirdField(ti, 'is_active', e.target.value === 'sí')}>
                    <option>sí</option>
                    <option>no</option>
                  </select>
                </div>
                <div style={{ flex: '1 1 220px' }}>
                  <label>Logo / Foto</label>
                  <input type="file" accept="image/*" onChange={(e) => updateThirdField(ti, 'logo_file', e.target.files?.[0] ?? null)} />
                </div>
                <div style={{ flex: '1 1 220px' }}>
                  <label>Contrato (PDF/imagen)</label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => updateThirdField(ti, 'contract_file', e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div style={{ marginTop: 8 }}>
                <h3 style={{ fontSize: 16 }}>Condiciones del tercero</h3>
                {t.econ.map((e, ci) => (
                  <div key={ci} className="row" style={{ marginTop: 6 }}>
                    <div style={{ flex: '1 1 220px' }}>
                      <div className="badge">{e.category}</div>
                    </div>
                    <div style={{ flex: '1 1 120px' }}>
                      <label>%</label>
                      <input
                        type="number"
                        value={e.third_pct}
                        onChange={(v) => updateThirdEcon(ti, ci, 'third_pct', Number(v.target.value))}
                      />
                    </div>
                    <div style={{ flex: '1 1 140px' }}>
                      <label>Base</label>
                      <select value={e.third_base} onChange={(v) => updateThirdEcon(ti, ci, 'third_base', v.target.value as any)}>
                        <option value="gross">Bruto</option>
                        <option value="net">Neto</option>
                      </select>
                    </div>
                    <div style={{ flex: '1 1 180px' }}>
                      <label>Ámbito base</label>
                      <select value={e.base_scope} onChange={(v) => updateThirdEcon(ti, ci, 'base_scope', v.target.value as any)}>
                        <option value="total">Total generado</option>
                        <option value="office">Ingresos/beneficio de oficina</option>
                        <option value="artist">Ingresos/beneficio de artista</option>
                      </select>
                    </div>
                    <div style={{ flex: '1 1 240px' }}>
                      <label>Exento</label>
                      <div className="row" style={{ gap: 8 }}>
                        <select
                          style={{ flex: '0 0 120px' }}
                          value={e.third_exempt_type}
                          onChange={(v) => updateThirdEcon(ti, ci, 'third_exempt_type', v.target.value as any)}
                        >
                          <option value="amount">Importe</option>
                          <option value="percent">%</option>
                        </select>
                        <input
                          style={{ flex: '1 1 auto' }}
                          type="number"
                          value={e.third_exempt_value}
                          onChange={(v) => updateThirdEcon(ti, ci, 'third_exempt_value', Number(v.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 8 }}>
                <button onClick={() => removeThird(ti)}>Eliminar tercero</button>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <button onClick={onSubmit}>Guardar artista</button>
        </div>
      </div>
    </Layout>
  )
}
