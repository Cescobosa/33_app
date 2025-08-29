import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'
import Button from '../../components/Button'

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
  brands_mode?: 'office_only'|'split'
}

const GENERAL_CATEGORIES = [
  'Conciertos a caché',
  'Conciertos a empresa',
  'Royalties Discográficos',
  'Editorial',
  'Merchandising',
  'Acciones con marcas',
  'Otras acciones'
]

function validateIBAN(iban:string): boolean {
  const s = (iban||'').replace(/\s+/g,'').toUpperCase()
  if (!s) return true
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{9,30}$/.test(s)) return false
  const rearr = s.slice(4) + s.slice(0,4)
  const converted = rearr.replace(/[A-Z]/g, ch => (ch.charCodeAt(0)-55).toString())
  let remainder = 0
  for (let i=0;i<converted.length;i+=7) remainder = parseInt(remainder.toString()+converted.substr(i,7),10) % 97
  return remainder === 1
}
const pctOK = (n:number) => n>=0 && n<=100

// ——— helpers
async function uploadAndSign(bucket:string, file:File) {
  const name = `${Date.now()}-${file.name.normalize('NFC')}`
  const { error: upErr } = await supabase.storage.from(bucket).upload(name, file)
  if (upErr) throw upErr
  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(name, 60*60*24*365)
  if (signErr || !data) throw signErr || new Error('No signed URL')
  return data.signedUrl
}

type Member = {
  full_name: string
  dni: string
  birth_date: string
  email: string
  phone: string
  tax_type: 'particular'|'empresa'
  tax_name: string
  tax_id: string
  share_pct: number
}

type ThirdEcon = { category:string; third_pct:number; third_base:'gross'|'net'; base_scope:'total'|'office'|'artist'; third_exempt_type:'amount'|'percent'; third_exempt_value:number }
type Third = {
  nick: string
  name: string
  tax_id: string
  email: string
  phone: string
  logo_file?: File|null
  logo_url?: string|null
  contract_file?: File|null
  contract_url?: string|null
  is_active: boolean
  econ: ThirdEcon[]
}

export default function NewArtist() {
  // Básicos
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [contractFile, setContractFile] = useState<File|null>(null)
  const [stageName, setStageName] = useState('')
  const [contractType, setContractType] = useState<'General'|'Booking'>('General')
  const [isGroup, setIsGroup] = useState(false)

  // Datos personales (artista individual)
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // Fiscales (individual)
  const [taxType, setTaxType] = useState<'particular'|'empresa'>('particular')
  const [taxName, setTaxName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [iban, setIban] = useState('')

  // Miembros (grupo)
  const emptyMember = (): Member => ({
    full_name:'', dni:'', birth_date:'', email:'', phone:'',
    tax_type:'particular', tax_name:'', tax_id:'', share_pct:0
  })
  const [members, setMembers] = useState<Member[]>([])

  // Reparto beneficio artista (grupo) — se guarda en share_pct de cada miembro
  useEffect(()=>{
    // Si cambia el número de miembros, ajusta el reparto para que sume 100 (reparto equitativo por defecto)
    if (!isGroup) return
    if (members.length === 0) return
    const eq = Math.floor((100 / members.length) * 100) / 100
    setMembers(ms => ms.map((m,i)=> ({...m, share_pct: ms.length ? (i===ms.length-1 ? (100 - eq*(ms.length-1)) : eq) : 0 })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroup, members.length])

  const updateMember = (idx:number, k:keyof Member, v:any) => {
    const c=[...members]; (c[idx] as any)[k]=v; setMembers(c)
  }
  const addMember = () => setMembers(ms=>[...ms, emptyMember()])
  const removeMember = (idx:number) => setMembers(ms=> ms.filter((_,i)=> i!==idx))

  // Económicas
  const makeEmptyGeneral = (): EconRow[] => GENERAL_CATEGORIES.map(c => ({
    category: c, artist_pct: 0, office_pct: 0,
    artist_base: 'gross', office_base:'gross',
    office_exempt_type: 'amount', office_exempt_value: 0,
    brands_mode: c==='Acciones con marcas' ? 'split' : undefined
  }))
  const [econGeneral, setEconGeneral] = useState<EconRow[]>(makeEmptyGeneral())

  const [bookingOfficePct, setBookingOfficePct] = useState(0)
  const [bookingOfficeBase, setBookingOfficeBase] = useState<'gross'|'net'>('gross')
  const [bookingExemptType, setBookingExemptType] = useState<'amount'|'percent'>('amount')
  const [bookingExemptValue, setBookingExemptValue] = useState(0)

  // Terceros vinculados (solo desde artista, como pides)
  const [thirds, setThirds] = useState<Third[]>([])
  const addThird = () => setThirds(t => [...t, {
    nick:'', name:'', tax_id:'', email:'', phone:'',
    logo_file:null, logo_url:null, contract_file:null, contract_url:null,
    is_active: true,
    econ: (contractType==='Booking'
      ? [{ category:'Booking', third_pct:0, third_base:'gross', base_scope:'total', third_exempt_type:'amount', third_exempt_value:0 }]
      : GENERAL_CATEGORIES.map(c=>({category:c, third_pct:0, third_base:'gross', base_scope:'total', third_exempt_type:'amount', third_exempt_value:0}))
    )
  }])
  const updateThirdField = (i:number, k:keyof Third, v:any) => {
    const copy=[...thirds]; (copy[i] as any)[k]=v; setThirds(copy)
  }
  const updateThirdEcon = (ti:number, ci:number, k:keyof ThirdEcon, v:any) => {
    const copy=[...thirds]; (copy[ti].econ[ci] as any)[k]=v; setThirds(copy)
  }
  const removeThird = (i:number) => setThirds(t => t.filter((_,idx)=>idx!==i))

  // Validaciones
  const validateAll = () => {
    if (!stageName.trim()) return 'Pon el nombre artístico.'
    if (!contractFile) return 'Debes adjuntar el contrato del artista.'
    if (iban && !validateIBAN(iban)) return 'IBAN no válido. Introduce el IBAN completo.'
    if (isGroup) {
      if (members.length < 2) return 'Un grupo debe tener al menos 2 miembros.'
      const sum = members.reduce((acc,m)=> acc + (Number(m.share_pct)||0), 0)
      if (Math.round(sum*100)/100 !== 100) return 'El reparto del grupo debe sumar 100%.'
    } else {
      if (taxType==='empresa' && (!taxName.trim() || !taxId.trim())) return 'Completa los datos fiscales de empresa vinculada.'
    }
    // Econ
    if (contractType==='Booking') {
      if (!pctOK(bookingOfficePct)) return '% Oficina (Booking) debe estar entre 0 y 100.'
      if (bookingExemptType==='percent' && !pctOK(bookingExemptValue)) return 'Exento (%) en Booking debe estar entre 0 y 100.'
    } else {
      for (const row of econGeneral) {
        if (row.category==='Conciertos a caché') {
          if (!pctOK(row.office_pct)) return 'En Caché, % Oficina debe estar entre 0 y 100.'
          if (row.office_exempt_type==='percent' && !pctOK(row.office_exempt_value)) return 'Exento (%) en Caché debe estar entre 0 y 100.'
        } else if (row.category==='Royalties Discográficos') {
          if (!pctOK(row.artist_pct)) return 'En Royalties, % Artista debe estar entre 0 y 100.'
        } else {
          if (!pctOK(row.artist_pct)) return `En ${row.category}, % Artista debe estar entre 0 y 100.`
          if (!pctOK(row.office_pct)) return `En ${row.category}, % Oficina debe estar entre 0 y 100.`
          if (row.office_exempt_type==='percent' && !pctOK(row.office_exempt_value)) return `En ${row.category}, Exento (%) debe estar entre 0 y 100.`
        }
      }
    }
    // Terceros
    for (const t of thirds) {
      for (const e of t.econ) {
        if (!pctOK(e.third_pct)) return 'En Terceros, % debe estar entre 0 y 100.'
        if (e.third_exempt_type==='percent' && !pctOK(e.third_exempt_value)) return 'En Terceros, Exento (%) debe estar entre 0 y 100.'
      }
    }
    return null
  }

  async function onSubmit() {
    const msg = validateAll()
    if (msg) return alert(msg)
    try {
      const photo_url = photoFile ? await uploadAndSign(BUCKET_PHOTOS, photoFile) : null
      const contract_url = await uploadAndSign(BUCKET_CONTRACTS, contractFile!)

      const { data: artist, error: aerr } = await supabase.from('artists').insert({
        stage_name: stageName,
        is_group: isGroup,
        contract_type: contractType,
        photo_url,

        // datos personales (individual)
        full_name: isGroup ? null : (fullName || null),
        dni: isGroup ? null : (dni || null),
        birth_date: isGroup ? null : (birthDate || null),
        email: isGroup ? null : (email || null),
        phone: isGroup ? null : (phone || null),

        // datos fiscales (individual)
        tax_type: isGroup ? null : taxType,
        tax_name: isGroup ? null : (taxType==='particular' ? (fullName || null) : (taxName || null)),
        tax_id: isGroup ? null : (taxType==='particular' ? (dni || null) : (taxId || null)),
        iban: isGroup ? null : (iban || null),

        contract_url
      }).select('*').single()
      if (aerr) throw aerr

      // Miembros (grupo)
      if (isGroup) {
        for (const m of members) {
          if ((m.full_name||'').trim()) {
            const payload:any = {
              artist_id: artist.id,
              full_name: m.full_name, dni: m.dni || null,
              birth_date: m.birth_date || null,
              email: m.email || null, phone: m.phone || null,
              tax_type: m.tax_type,
              tax_name: m.tax_type==='particular' ? (m.full_name||null) : (m.tax_name||null),
              tax_id: m.tax_type==='particular' ? (m.dni||null) : (m.tax_id||null),
              share_pct: m.share_pct || 0
            }
            const { error } = await supabase.from('artist_members').insert(payload)
            if (error) throw error
          }
        }
      }

      // Económicas
      if (contractType === 'Booking') {
        const { error } = await supabase.from('artist_economics').insert({
          artist_id: artist.id, category: 'Booking',
          artist_pct: 0, office_pct: bookingOfficePct,
          artist_base: 'gross', office_base: bookingOfficeBase,
          office_exempt_type: bookingExemptType, office_exempt_value: bookingExemptValue
        })
        if (error) throw error
      } else {
        for (const e of econGeneral) {
          const row = { ...e }
          if (row.category === 'Conciertos a caché') { row.artist_pct = 0 }
          if (row.category === 'Royalties Discográficos') {
            row.office_pct = 0; row.office_base='gross'; row.office_exempt_type='amount'; row.office_exempt_value=0
          }
          const payload:any = {
            artist_id: artist.id,
            category: row.category,
            artist_pct: row.artist_pct,
            office_pct: row.office_pct,
            artist_base: row.artist_base,
            office_base: row.office_base,
            office_exempt_type: row.office_exempt_type,
            office_exempt_value: row.office_exempt_value,
            brands_mode: row.category==='Acciones con marcas' ? row.brands_mode : null
          }
          const { error } = await supabase.from('artist_economics').insert(payload)
          if (error) throw error
        }
      }

      // Terceros vinculados
      for (const t of thirds) {
        let logo_url: string | null = null
        let t_contract_url: string | null = null
        if (t.logo_file) logo_url = await uploadAndSign(BUCKET_PHOTOS, t.logo_file)
        if (t.contract_file) t_contract_url = await uploadAndSign(BUCKET_CONTRACTS, t.contract_file)
        const { data: tp, error } = await supabase.from('third_parties').insert({
          artist_id: artist.id,
          kind: 'third',
          nick: t.nick || null,
          name: t.name || null,
          tax_id: t.tax_id || null,
          email: t.email || null,
          phone: t.phone || null,
          logo_url, contract_url: t_contract_url, is_active: t.is_active
        }).select('*').single()
        if (error) throw error
        for (const ec of t.econ) {
          const { error: e2 } = await supabase.from('third_party_economics').insert({
            third_party_id: tp.id,
            category: ec.category,
            third_pct: ec.third_pct,
            third_base: ec.third_base,
            base_scope: ec.base_scope,
            third_exempt_type: ec.third_exempt_type,
            third_exempt_value: ec.third_exempt_value
          })
          if (e2) throw e2
        }
      }

      alert('Artista creado con éxito.')
      window.location.href = '/artists'
    } catch (e:any) {
      alert(e.message || 'Error guardando artista')
    }
  }

  // UI helpers
  const econRowUI = (e:EconRow, i:number) => {
    const isCache = e.category==='Conciertos a caché'
    const isRoy = e.category==='Royalties Discográficos'
    const isBrand = e.category==='Acciones con marcas'
    return (
      <div key={i} className="row" style={{borderTop:'1px solid #e5e7eb', paddingTop:12, marginTop:12}}>
        <div style={{flex:'1 1 220px'}}><div className="badge">{e.category}</div></div>

        {isBrand && (
          <div style={{flex:'1 1 220px'}}>
            <label>Modo</label>
            <select value={e.brands_mode ?? 'split'} onChange={v=> {
              const copy=[...econGeneral]; (copy[i] as any).brands_mode = (v.target.value as any); setEconGeneral(copy)
            }}>
              <option value="office_only">Comisión de oficina</option>
              <option value="split">Reparto porcentajes</option>
            </select>
          </div>
        )}

        {!isRoy && (
          <>
            <div style={{flex:'1 1 120px'}}><label>% Oficina</label>
              <input type="number" value={e.office_pct} onChange={v=>{
                const copy=[...econGeneral]; (copy[i] as any).office_pct = Number(v.target.value); setEconGeneral(copy)
              }}/></div>
            <div style={{flex:'1 1 140px'}}><label>Base Oficina</label>
              <select value={e.office_base} onChange={v=>{
                const copy=[...econGeneral]; (copy[i] as any).office_base = (v.target.value as any); setEconGeneral(copy)
              }}>
                <option value="gross">Bruto</option><option value="net">Neto</option>
              </select></div>
            <div style={{flex:'1 1 220px'}}><label>Exento (Oficina)</label>
              <div className="row" style={{gap:8}}>
                <select style={{flex:'0 0 120px'}} value={e.office_exempt_type} onChange={v=>{
                  const copy=[...econGeneral]; (copy[i] as any).office_exempt_type = (v.target.value as any); setEconGeneral(copy)
                }}>
                  <option value="amount">Importe</option><option value="percent">%</option>
                </select>
                <input style={{flex:'1 1 auto'}} type="number" value={e.office_exempt_value} onChange={v=>{
                  const copy=[...econGeneral]; (copy[i] as any).office_exempt_value = Number(v.target.value); setEconGeneral(copy)
                }}/>
              </div>
            </div>
          </>
        )}

        {(!isCache && !isBrand) && (
          <div style={{flex:'1 1 120px'}}><label>% Artista</label>
            <input type="number" value={e.artist_pct} onChange={v=>{
              const copy=[...econGeneral]; (copy[i] as any).artist_pct = Number(v.target.value); setEconGeneral(copy)
            }}/></div>
        )}

        {isRoy && (
          <div style={{flex:'1 1 140px'}}><label>Base Artista</label>
            <select value={e.artist_base} onChange={v=>{
              const copy=[...econGeneral]; (copy[i] as any).artist_base = (v.target.value as any); setEconGeneral(copy)
            }}>
              <option value="gross">Bruto</option><option value="net">Neto</option>
            </select></div>
        )}

        {(!isCache && isBrand && e.brands_mode!=='office_only') && (
          <div style={{flex:'1 1 140px'}}><label>Base Artista</label>
            <select value={e.artist_base} onChange={v=>{
              const copy=[...econGeneral]; (copy[i] as any).artist_base = (v.target.value as any); setEconGeneral(copy)
            }}>
              <option value="gross">Bruto</option><option value="net">Neto</option>
            </select></div>
        )}
      </div>
    )
  }

  return (
    <Layout>
      <h1>Nuevo artista</h1>

      {/* Básicos */}
      <div className="module">
        <h2>Datos básicos</h2>
        <div className="row">
          <div style={{flex:'1 1 220px'}}>
            <label>Fotografía</label>
            <input type="file" accept="image/*" onChange={e=>setPhotoFile(e.target.files?.[0] ?? null)}/>
          </div>
          <div style={{flex:'1 1 260px'}}>
            <label>Nombre artístico</label>
            <input value={stageName} onChange={e=>setStageName(e.target.value)}/>
          </div>
          <div style={{flex:'1 1 180px'}}>
            <label>Tipo contrato</label>
            <select value={contractType} onChange={e=>{ setContractType(e.target.value as any); setThirds([]); }}>
              <option value="General">General</option>
              <option value="Booking">Booking</option>
            </select>
          </div>
          <div style={{flex:'1 1 160px'}}>
            <label>¿Es grupo?</label>
            <select value={isGroup ? 'sí':'no'} onChange={e=>setIsGroup(e.target.value==='sí')}>
              <option>no</option><option>sí</option>
            </select>
          </div>
        </div>
      </div>

      {/* Datos personales */}
      <div className="module">
        <h2>Datos personales</h2>
        {!isGroup ? (
          <div className="row">
            <div style={{flex:'1 1 260px'}}><label>Nombre completo</label><input value={fullName} onChange={e=>setFullName(e.target.value)}/></div>
            <div style={{flex:'1 1 160px'}}><label>DNI</label><input value={dni} onChange={e=>setDni(e.target.value)}/></div>
            <div style={{flex:'1 1 180px'}}><label>Nacimiento</label><input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></div>
            <div style={{flex:'1 1 260px'}}><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)}/></div>
            <div style={{flex:'1 1 180px'}}><label>Teléfono</label><input value={phone} onChange={e=>setPhone(e.target.value)}/></div>
          </div>
        ) : (
          <div>
            <Button onClick={addMember}>+ Añadir miembro</Button>
            {members.map((m,i)=>(
              <div key={i} className="card">
                <div className="row">
                  <div style={{flex:'1 1 300px'}}><label>Nombre completo</label><input value={m.full_name} onChange={e=>updateMember(i,'full_name', e.target.value)}/></div>
                  <div style={{flex:'1 1 160px'}}><label>DNI</label><input value={m.dni} onChange={e=>updateMember(i,'dni', e.target.value)}/></div>
                  <div style={{flex:'1 1 180px'}}><label>Nacimiento</label><input type="date" value={m.birth_date} onChange={e=>updateMember(i,'birth_date', e.target.value)}/></div>
                </div>
                <div className="row">
                  <div style={{flex:'1 1 260px'}}><label>Email</label><input value={m.email} onChange={e=>updateMember(i,'email', e.target.value)}/></div>
                  <div style={{flex:'1 1 180px'}}><label>Teléfono</label><input value={m.phone} onChange={e=>updateMember(i,'phone', e.target.value)}/></div>
                </div>
                <div className="row">
                  <div style={{flex:'1 1 180px'}}><label>Tipo fiscal</label>
                    <select value={m.tax_type} onChange={e=>updateMember(i,'tax_type', e.target.value as any)}>
                      <option value="particular">Particular</option><option value="empresa">Empresa vinculada</option>
                    </select></div>
                  <div style={{flex:'1 1 260px'}}><label>Nombre fiscal / Empresa</label>
                    <input value={m.tax_type==='particular' ? (m.full_name||'') : (m.tax_name||'')}
                           onChange={e=>updateMember(i,'tax_name', e.target.value)}
                           disabled={m.tax_type==='particular'}/></div>
                  <div style={{flex:'1 1 200px'}}><label>NIF/CIF</label>
                    <input value={m.tax_type==='particular' ? (m.dni||'') : (m.tax_id||'')}
                           onChange={e=>updateMember(i,'tax_id', e.target.value)}
                           disabled={m.tax_type==='particular'}/></div>
                  <div style={{flex:'1 1 160px'}}><label>% reparto</label>
                    <input type="number" value={m.share_pct} onChange={e=>updateMember(i,'share_pct', Number(e.target.value))}/></div>
                </div>
                <div style={{textAlign:'right'}}><Button tone="danger" onClick={()=>removeMember(i)}>Eliminar miembro</Button></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Datos fiscales (solo individual) */}
      {!isGroup && (
        <div className="module">
          <h2>Datos fiscales</h2>
          <div className="row">
            <div style={{flex:'1 1 160px'}}><label>Tipo fiscal</label>
              <select value={taxType} onChange={e=>setTaxType(e.target.value as any)}>
                <option value="particular">Particular</option><option value="empresa">Empresa vinculada</option>
              </select></div>
            <div style={{flex:'1 1 260px'}}><label>Nombre fiscal / Empresa</label>
              <input value={taxType==='particular' ? (fullName||'') : (taxName||'')}
                     onChange={e=>setTaxName(e.target.value)} disabled={taxType==='particular'}/></div>
            <div style={{flex:'1 1 200px'}}><label>NIF/CIF</label>
              <input value={taxType==='particular' ? (dni||'') : (taxId||'')}
                     onChange={e=>setTaxId(e.target.value)} disabled={taxType==='particular'}/></div>
            <div style={{flex:'1 1 300px'}}><label>IBAN</label>
              <input value={iban} onChange={e=>setIban(e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000"/></div>
          </div>
        </div>
      )}

      {/* Contrato */}
      <div className="module">
        <h2>Contrato</h2>
        <input type="file" accept=".pdf" onChange={e=>setContractFile(e.target.files?.[0] ?? null)}/>
        <small>Solo PDF</small>
      </div>

      {/* Económicas */}
      {contractType === 'Booking' ? (
        <div className="module">
          <h2>Condiciones — Booking</h2>
          <div className="row">
            <div style={{flex:'1 1 140px'}}><label>% Oficina</label>
              <input type="number" value={bookingOfficePct} onChange={e=>setBookingOfficePct(Number(e.target.value))}/></div>
            <div style={{flex:'1 1 160px'}}><label>Base</label>
              <select value={bookingOfficeBase} onChange={e=>setBookingOfficeBase(e.target.value as any)}>
                <option value="gross">Bruto</option><option value="net">Neto</option>
              </select></div>
            <div style={{flex:'1 1 260px'}}><label>Exento comisión</label>
              <div className="row" style={{gap:8}}>
                <select style={{flex:'0 0 120px'}} value={bookingExemptType} onChange={e=>setBookingExemptType(e.target.value as any)}>
                  <option value="amount">Importe</option><option value="percent">%</option>
                </select>
                <input style={{flex:'1 1 auto'}} type="number" value={bookingExemptValue} onChange={e=>setBookingExemptValue(Number(e.target.value))}/>
              </div></div>
          </div>
        </div>
      ) : (
        <div className="module">
          <h2>Condiciones — General</h2>
          {econGeneral.map((e,i)=> econRowUI(e, i))}
          <small>“Caché”: solo % Oficina. “Royalties”: solo % Artista + base. “Marcas”: elige modo en la fila.</small>
        </div>
      )}

      {/* Terceros vinculados */}
      <div className="module" id="thirds">
        <h2>Terceros vinculados</h2>
        <Button onClick={addThird}>+ Añadir tercero</Button>
        {thirds.map((t, ti)=>(
          <div key={ti} className="card">
            <div className="row">
              <div style={{flex:'1 1 200px'}}><label>Nick</label>
                <input value={t.nick} onChange={e=>updateThirdField(ti,'nick', e.target.value)}/></div>
              <div style={{flex:'1 1 260px'}}><label>Nombre/Compañía</label>
                <input value={t.name} onChange={e=>updateThirdField(ti,'name', e.target.value)}/></div>
              <div style={{flex:'1 1 200px'}}><label>NIF/CIF</label>
                <input value={t.tax_id} onChange={e=>updateThirdField(ti,'tax_id', e.target.value)}/></div>
              <div style={{flex:'1 1 200px'}}><label>Email liquidaciones</label>
                <input value={t.email} onChange={e=>updateThirdField(ti,'email', e.target.value)}/></div>
              <div style={{flex:'1 1 160px'}}><label>Teléfono</label>
                <input value={t.phone} onChange={e=>updateThirdField(ti,'phone', e.target.value)}/></div>
              <div style={{flex:'1 1 220px'}}><label>Logo / Foto</label>
                <input type="file" accept="image/*" onChange={e=>updateThirdField(ti,'logo_file', e.target.files?.[0] ?? null)}/></div>
              <div style={{flex:'1 1 220px'}}><label>Contrato (PDF)</label>
                <input type="file" accept=".pdf" onChange={e=>updateThirdField(ti,'contract_file', e.target.files?.[0] ?? null)}/></div>
            </div>

            <div style={{marginTop:8}}>
              <h3 style={{fontSize:16}}>Condiciones del tercero</h3>
              {t.econ.map((e, ci)=>(
                <div key={ci} className="row" style={{marginTop:6}}>
                  <div style={{flex:'1 1 220px'}}><div className="badge">{e.category}</div></div>
                  <div style={{flex:'1 1 120px'}}><label>%</label>
                    <input type="number" value={e.third_pct} onChange={v=>updateThirdEcon(ti,ci,'third_pct', Number(v.target.value))}/></div>
                  <div style={{flex:'1 1 140px'}}><label>Base</label>
                    <select value={e.third_base} onChange={v=>updateThirdEcon(ti,ci,'third_base', v.target.value as any)}>
                      <option value="gross">Bruto</option><option value="net">Neto</option>
                    </select></div>
                  <div style={{flex:'1 1 180px'}}><label>Ámbito base</label>
                    <select value={e.base_scope} onChange={v=>updateThirdEcon(ti,ci,'base_scope', v.target.value as any)}>
                      <option value="total">Total generado</option>
                      <option value="office">Ingresos/beneficio de oficina</option>
                      <option value="artist">Ingresos/beneficio de artista</option>
                    </select></div>
                  <div style={{flex:'1 1 240px'}}><label>Exento</label>
                    <div className="row" style={{gap:8}}>
                      <select style={{flex:'0 0 120px'}} value={e.third_exempt_type} onChange={v=>updateThirdEcon(ti,ci,'third_exempt_type', v.target.value as any)}>
                        <option value="amount">Importe</option><option value="percent">%</option>
                      </select>
                      <input style={{flex:'1 1 auto'}} type="number" value={e.third_exempt_value} onChange={v=>updateThirdEcon(ti,ci,'third_exempt_value', Number(v.target.value))}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{marginTop:8, textAlign:'right'}}>
              <Button tone="danger" onClick={()=>removeThird(ti)}>Eliminar tercero</Button>
            </div>
          </div>
        ))}
      </div>

      <div className="module">
        <Button onClick={onSubmit}>Guardar artista</Button>
      </div>
    </Layout>
  )
}
