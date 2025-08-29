import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import { supabase } from '../../lib/supabaseClient'
import { validateIBAN, pctOK } from '../../utils/validators'
import HeaderCard from '../../components/HeaderCard'
import ContractUploader from '../../components/ContractUploader'

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

async function uploadAndSign(bucket:string, file:File) {
  const name = `${Date.now()}-${file.name}`
  const { error: upErr } = await supabase.storage.from(bucket).upload(name, file)
  if (upErr) throw upErr
  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(name, 60*60*24*365)
  if (signErr || !data) throw signErr || new Error('No signed URL')
  return data.signedUrl
}

export default function NewArtist() {
  // foto y preview
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [photoPreview, setPhotoPreview] = useState<string|undefined>(undefined)
  useEffect(()=>{ if(photoFile){ setPhotoPreview(URL.createObjectURL(photoFile)) } }, [photoFile])

  // básicos
  const [stageName, setStageName] = useState('')
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [contractType, setContractType] = useState<'General'|'Booking'>('General')

  // fiscales
  const [taxType, setTaxType] = useState<'particular'|'empresa'>('particular')
  const [taxName, setTaxName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [iban, setIban] = useState('')

  // miembros
  const [members, setMembers] = useState<{full_name:string; dni:string}[]>([])
  const addMember = ()=> setMembers(m=>[...m, {full_name:'', dni:''}])
  const updateMember = (i:number, k:'full_name'|'dni', v:string)=>{ const c=[...members]; (c[i] as any)[k]=v; setMembers(c) }
  const removeMember = (i:number)=> setMembers(m=>m.filter((_,idx)=>idx!==i))

  // economía
  const makeEmptyGeneral = ():EconRow[] => GENERAL_CATEGORIES.map(c=>({
    category:c, artist_pct:0, office_pct:0, artist_base:'gross', office_base:'gross',
    office_exempt_type:'amount', office_exempt_value:0, brands_mode: c==='Acciones con marcas' ? 'split' : undefined
  }))
  const [econGeneral, setEconGeneral] = useState<EconRow[]>(makeEmptyGeneral())
  const handleEconGeneral = (i:number,k:keyof EconRow,v:any)=>{ const c=[...econGeneral]; (c[i] as any)[k]=v; setEconGeneral(c) }

  // booking simple
  const [bookingOfficePct, setBookingOfficePct] = useState(0)
  const [bookingOfficeBase, setBookingOfficeBase] = useState<'gross'|'net'>('gross')
  const [bookingExemptType, setBookingExemptType] = useState<'amount'|'percent'>('amount')
  const [bookingExemptValue, setBookingExemptValue] = useState(0)

  // contratos (múltiples)
  const [newContracts, setNewContracts] = useState<{name:string; signed_at:string; is_active:boolean; file:File}[]>([])

  useEffect(()=>{ if (taxType==='particular') { setTaxName(fullName); setTaxId(dni) } }, [taxType, fullName, dni])

  const validateAll = ()=>{
    if (!stageName.trim()) return 'Pon el nombre artístico.'
    if (iban && !validateIBAN(iban)) return 'IBAN no válido.'
    if (contractType==='Booking') {
      if (!pctOK(bookingOfficePct)) return 'Booking: % Oficina 0-100.'
      if (bookingExemptType==='percent' && !pctOK(bookingExemptValue)) return 'Booking: Exento (%) 0-100.'
    } else {
      for (const row of econGeneral) {
        if (row.category==='Conciertos a caché') {
          if (!pctOK(row.office_pct)) return 'Caché: % Oficina 0-100.'
          if (row.office_exempt_type==='percent' && !pctOK(row.office_exempt_value)) return 'Caché: Exento (%) 0-100.'
        } else if (row.category==='Royalties Discográficos') {
          if (!pctOK(row.artist_pct)) return 'Royalties: % Artista 0-100.'
        } else {
          if (!pctOK(row.artist_pct)) return `% Artista 0-100.`
          if (!pctOK(row.office_pct)) return `% Oficina 0-100.`
          if (row.office_exempt_type==='percent' && !pctOK(row.office_exempt_value)) return `Exento (%) 0-100.`
        }
      }
    }
    return null
  }

  const onSubmit = async ()=>{
    const msg = validateAll()
    if (msg) return alert(msg)
    try {
      const photo_url = photoFile ? await uploadAndSign(BUCKET_PHOTOS, photoFile) : null

      const { data: artist, error: aerr } = await supabase.from('artists').insert({
        stage_name: stageName,
        full_name: fullName || null,
        dni: dni || null,
        birth_date: birthDate || null,
        is_group: isGroup,
        contract_type: contractType,
        photo_url,
        tax_type: taxType,
        tax_name: (taxName || null),
        tax_id: (taxId || null),
        iban: iban || null
      }).select('*').single()
      if (aerr) throw aerr

      // miembros
      for (const m of members) {
        if (m.full_name) await supabase.from('artist_members').insert({ artist_id: artist.id, full_name: m.full_name, dni: m.dni || null })
      }

      // economía
      if (contractType==='Booking') {
        await supabase.from('artist_economics').insert({
          artist_id: artist.id,
          category: 'Booking',
          artist_pct: 0,
          office_pct: bookingOfficePct,
          artist_base: 'gross',
          office_base: bookingOfficeBase,
          office_exempt_type: bookingExemptType,
          office_exempt_value: bookingExemptValue
        })
      } else {
        for (const e of econGeneral) {
          const row = { ...e }
          if (row.category === 'Conciertos a caché') row.artist_pct = 0
          if (row.category === 'Royalties Discográficos') {
            row.office_pct = 0; row.office_base = 'gross'; row.office_exempt_type='amount'; row.office_exempt_value=0
          }
          const payload:any = {
            artist_id: artist.id,
            category: row.category,
            artist_pct: row.artist_pct,
            office_pct: row.office_pct,
            artist_base: row.artist_base,
            office_base: row.office_base,
            office_exempt_type: row.office_exempt_type,
            office_exempt_value: row.office_exempt_value
          }
          if (row.category==='Acciones con marcas') payload.brands_mode = row.brands_mode
          await supabase.from('artist_economics').insert(payload)
        }
      }

      // contratos
      for (const c of newContracts) {
        const url = await uploadAndSign(BUCKET_CONTRACTS, c.file)
        await supabase.from('artist_contracts').insert({
          artist_id: artist.id, name: c.name, signed_at: c.signed_at, is_active: c.is_active, file_url: url
        })
      }

      alert('Artista creado con éxito.')
      window.location.href = '/artists'
    } catch(e:any) {
      alert(e.message || 'Error guardando artista')
    }
  }

  const econRowUI = (e:EconRow, i:number)=>{
    const isCache = e.category==='Conciertos a caché'
    const isRoy = e.category==='Royalties Discográficos'
    const isBrand = e.category==='Acciones con marcas'
    return (
      <div key={i} className="row" style={{borderTop:'1px solid #e5e7eb', paddingTop:12, marginTop:12}}>
        <div style={{flex:'1 1 220px'}}><div className="badge">{e.category}</div></div>

        {isBrand && (
          <div style={{flex:'1 1 220px'}}>
            <label>Modo</label>
            <select value={e.brands_mode ?? 'split'} onChange={v=>handleEconGeneral(i,'brands_mode', v.target.value as any)}>
              <option value="office_only">Comisión de oficina</option>
              <option value="split">Reparto porcentajes</option>
            </select>
          </div>
        )}

        {!isCache && !isRoy && !(isBrand && e.brands_mode==='office_only') && (
          <div style={{flex:'1 1 120px'}}>
            <label>% Artista</label>
            <input type="number" value={e.artist_pct} onChange={v=>handleEconGeneral(i,'artist_pct', Number(v.target.value))}/>
          </div>
        )}
        {isRoy && (
          <>
            <div style={{flex:'1 1 120px'}}>
              <label>% Artista</label>
              <input type="number" value={e.artist_pct} onChange={v=>handleEconGeneral(i,'artist_pct', Number(v.target.value))}/>
            </div>
            <div style={{flex:'1 1 140px'}}>
              <label>Base Artista</label>
              <select value={e.artist_base} onChange={v=>handleEconGeneral(i,'artist_base', v.target.value as any)}>
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
          </>
        )}

        {!isRoy && (
          <>
            <div style={{flex:'1 1 120px'}}>
              <label>% Oficina</label>
              <input type="number" value={e.office_pct} onChange={v=>handleEconGeneral(i,'office_pct', Number(v.target.value))}/>
            </div>
            <div style={{flex:'1 1 140px'}}>
              <label>Base Oficina</label>
              <select value={e.office_base} onChange={v=>handleEconGeneral(i,'office_base', v.target.value as any)}>
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
            <div style={{flex:'1 1 220px'}}>
              <label>Exento (Oficina)</label>
              <div className="row" style={{gap:8}}>
                <select style={{flex:'0 0 120px'}} value={e.office_exempt_type} onChange={v=>handleEconGeneral(i,'office_exempt_type', v.target.value as any)}>
                  <option value="amount">Importe</option><option value="percent">%</option>
                </select>
                <input style={{flex:'1 1 auto'}} type="number" value={e.office_exempt_value} onChange={v=>handleEconGeneral(i,'office_exempt_value', Number(v.target.value))}/>
              </div>
            </div>
          </>
        )}

        {!isCache && !isRoy && !(isBrand && e.brands_mode==='office_only') && (
          <div style={{flex:'1 1 140px'}}>
            <label>Base Artista</label>
            <select value={e.artist_base} onChange={v=>handleEconGeneral(i,'artist_base', v.target.value as any)}>
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
      <HeaderCard photoUrl={photoPreview || null} title={stageName || 'Nuevo artista'} />

      <div className="module">
        <h2>Datos básicos</h2>
        <div className="row">
          <div style={{flex:'1 1 220px'}}>
            <label>Fotografía</label>
            <input type="file" accept="image/*" onChange={e=>setPhotoFile(e.target.files?.[0] ?? null)}/>
          </div>
          <div style={{flex:'1 1 220px'}}>
            <label>Nombre artístico</label>
            <input value={stageName} onChange={e=>setStageName(e.target.value)} />
          </div>
          <div style={{flex:'1 1 220px'}}>
            <label>Nombre completo</label>
            <input value={fullName} onChange={e=>setFullName(e.target.value)}/>
          </div>
          <div style={{flex:'1 1 120px'}}>
            <label>DNI</label>
            <input value={dni} onChange={e=>setDni(e.target.value)}/>
          </div>
          <div style={{flex:'1 1 160px'}}>
            <label>Fecha de nacimiento</label>
            <input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/>
          </div>
          <div style={{flex:'1 1 160px'}}>
            <label>Tipo de contrato</label>
            <select value={contractType} onChange={e=>setContractType(e.target.value as any)}>
              <option value="General">General</option>
              <option value="Booking">Booking</option>
            </select>
          </div>
          <div style={{flex:'1 1 160px'}}>
            <label>¿Es grupo?</label>
            <select value={isGroup?'sí':'no'} onChange={e=>setIsGroup(e.target.value==='sí')}>
              <option>no</option><option>sí</option>
            </select>
          </div>
        </div>
      </div>

      <div className="module">
        <h2>Datos fiscales</h2>
        <div className="row">
          <div style={{flex:'1 1 160px'}}>
            <label>Tipo fiscal</label>
            <select value={taxType} onChange={e=>setTaxType(e.target.value as any)}>
              <option value="particular">Particular</option>
              <option value="empresa">Empresa vinculada</option>
            </select>
          </div>
          <div style={{flex:'1 1 260px'}}>
            <label>Nombre fiscal / Empresa</label>
            <input value={taxName} onChange={e=>setTaxName(e.target.value)} />
          </div>
          <div style={{flex:'1 1 200px'}}>
            <label>NIF/CIF</label>
            <input value={taxId} onChange={e=>setTaxId(e.target.value)} />
          </div>
          <div style={{flex:'1 1 260px'}}>
            <label>IBAN</label>
            <input value={iban} onChange={e=>setIban(e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000"/>
          </div>
        </div>
      </div>

      {isGroup && (
        <div className="module">
          <h2>Miembros del grupo</h2>
          <button onClick={addMember}>+ Añadir miembro</button>
          {members.map((m,i)=>(
            <div key={i} className="row" style={{marginTop:8}}>
              <div style={{flex:'1 1 300px'}}><label>Nombre completo</label>
                <input value={m.full_name} onChange={e=>updateMember(i,'full_name', e.target.value)}/></div>
              <div style={{flex:'1 1 200px'}}><label>DNI</label>
                <input value={m.dni} onChange={e=>updateMember(i,'dni', e.target.value)}/></div>
              <div style={{display:'flex', alignItems:'flex-end'}}><button onClick={()=>removeMember(i)}>Eliminar</button></div>
            </div>
          ))}
        </div>
      )}

      {contractType==='Booking' ? (
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
          {econGeneral.map((e,i)=> econRowUI(e,i))}
          <small>“Caché”: solo % Oficina. “Royalties”: solo % Artista + base. “Marcas”: elige modo en la fila.</small>
        </div>
      )}

      <div className="module">
        <h2>Contratos (PDF)</h2>
        <ContractUploader onAdd={(c)=> setNewContracts(v=>[...v, c])} />
        {newContracts.map((c,i)=>(
          <div key={i} className="row" style={{gap:8}}>
            <div style={{flex:'0 0 260px'}}>{c.name}</div>
            <div>Firma: {c.signed_at}</div>
            {c.is_active && <span className="tag tag-green">En Vigor</span>}
          </div>
        ))}
      </div>

      <div className="module">
        <button onClick={onSubmit}>Guardar artista</button>
      </div>
    </Layout>
  )
}
