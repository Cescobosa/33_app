import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Nav from '../../components/Nav'

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

export default function NewArtist() {
  // archivos
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [contractFile, setContractFile] = useState<File|null>(null)

  // básicos
  const [stageName, setStageName] = useState('')
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [isGroup, setIsGroup] = useState(false)

  // contrato: General / Booking
  const [contractType, setContractType] = useState<'General'|'Booking'>('General')

  // fiscales
  const [taxType, setTaxType] = useState<'particular'|'empresa'>('particular')
  const [taxName, setTaxName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [iban, setIban] = useState('')

  // miembros
  const [members, setMembers] = useState<{full_name:string; dni:string}[]>([])

  // GENERAL: condiciones por categoría
  const makeEmptyGeneral = (): EconRow[] => GENERAL_CATEGORIES.map(c => ({
    category: c,
    artist_pct: 0,
    office_pct: 0,
    artist_base: 'gross',
    office_base: 'gross',
    office_exempt_type: 'amount',
    office_exempt_value: 0
  }))
  const [econGeneral, setEconGeneral] = useState<EconRow[]>(makeEmptyGeneral())

  // toggle especial Acciones con marcas (modo actual o solo comisión oficina)
  const [brandsOfficeOnly, setBrandsOfficeOnly] = useState(false)

  // BOOKING: solo una fila
  const [bookingOfficePct, setBookingOfficePct] = useState(0)
  const [bookingOfficeBase, setBookingOfficeBase] = useState<'gross'|'net'>('gross')
  const [bookingExemptType, setBookingExemptType] = useState<'amount'|'percent'>('amount')
  const [bookingExemptValue, setBookingExemptValue] = useState(0)

  // terceros
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
    econ: ThirdEcon[]
  }
  const [thirds, setThirds] = useState<Third[]>([])

  // auto-relleno fiscal si particular
  useEffect(() => {
    if (taxType === 'particular') {
      setTaxName(fullName)
      setTaxId(dni)
    }
  }, [taxType, fullName, dni])

  const addMember = () => setMembers(m => [...m, {full_name:'', dni:''}])
  const updateMember = (i:number, k:'full_name'|'dni', v:string) => {
    const copy = [...members]; (copy[i] as any)[k]=v; setMembers(copy)
  }
  const removeMember = (i:number) => setMembers(m => m.filter((_,idx)=>idx!==i))

  const addThird = () => setThirds(t => [...t, {
    nick:'', name:'', tax_id:'', email:'', phone:'',
    logo_file:null, logo_url:null, contract_file:null, contract_url:null,
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

  const handleEconGeneral = (i:number, k:keyof EconRow, v:any) => {
    const copy=[...econGeneral]; (copy[i] as any)[k]=v; setEconGeneral(copy)
  }

  // helpers de subida con URL firmada (privado)
  async function uploadAndSign(bucket:string, file:File): Promise<string> {
    const name = `${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from(bucket).upload(name, file)
    if (upErr) throw upErr
    const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(name, 60*60*24*365)
    if (signErr || !data) throw signErr || new Error('No signed URL')
    return data.signedUrl
  }

  const onSubmit = async () => {
    try {
      // validaciones mínimas
      if (!stageName.trim()) return alert('Pon el nombre artístico.')
      if (!contractFile) return alert('Debes adjuntar el contrato del artista.')

      // uploads artista
      const photo_url = photoFile ? await uploadAndSign(BUCKET_PHOTOS, photoFile) : null
      const contract_url = await uploadAndSign(BUCKET_CONTRACTS, contractFile)

      // crear artista
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
        iban: iban || null,
        contract_url
      }).select('*').single()
      if (aerr) throw aerr

      // miembros
      for (const m of members) {
        if (m.full_name) {
          const { error } = await supabase.from('artist_members').insert({ artist_id: artist.id, full_name: m.full_name, dni: m.dni || null })
          if (error) throw error
        }
      }

      // ECONOMÍA
      if (contractType === 'Booking') {
        // insertar solo 1 fila Booking
        const { error } = await supabase.from('artist_economics').insert({
          artist_id: artist.id,
          category: 'Booking',
          artist_pct: 0,
          office_pct: bookingOfficePct,
          artist_base: 'gross',
          office_base: bookingOfficeBase,
          office_exempt_type: bookingExemptType,
          office_exempt_value: bookingExemptValue
        })
        if (error) throw error
      } else {
        // Ajustes por categoría según nuevos requisitos
        for (const e of econGeneral) {
          const row = { ...e }

          if (row.category === 'Conciertos a caché') {
            // Solo comisión oficina
            row.artist_pct = 0
          }
          if (row.category === 'Royalties Discográficos') {
            // Solo % artista + base artista
            row.office_pct = 0
            row.office_base = 'gross'
            row.office_exempt_type = 'amount'
            row.office_exempt_value = 0
          }
          if (row.category === 'Acciones con marcas') {
            // Modo actual o solo comisión oficina
            if (brandsOfficeOnly) {
              row.artist_pct = 0
              // office_* ya vienen del form
            }
          }

          const { error } = await supabase.from('artist_economics').insert({
            artist_id: artist.id,
            category: row.category,
            artist_pct: row.artist_pct,
            office_pct: row.office_pct,
            artist_base: row.artist_base,
            office_base: row.office_base,
            office_exempt_type: row.office_exempt_type,
            office_exempt_value: row.office_exempt_value
          })
          if (error) throw error
        }
      }

      // TERCEROS
      for (const t of thirds) {
        let logo_url: string | null = null
        let t_contract_url: string | null = null
        if (t.logo_file) logo_url = await uploadAndSign(BUCKET_PHOTOS, t.logo_file)
        if (t.contract_file) t_contract_url = await uploadAndSign(BUCKET_CONTRACTS, t.contract_file)

        const { data: tp, error } = await supabase.from('third_parties').insert({
          artist_id: artist.id,
          nick: t.nick,
          name: t.name,
          tax_id: t.tax_id || null,
          email: t.email || null,
          phone: t.phone || null,
          logo_url,
          contract_url: t_contract_url
        }).select('*').single()
        if (error) throw error

        for (const ec of t.econ) {
          const { error: e2 } = await supabase.from('third_party_economics').insert({
            third_party_id: tp.id,
            category: ec.category,
            third_pct: ec.third_pct,
            third_base: ec.third_base,
            base_scope: ec.base_scope,               // total | office | artist
            third_exempt_type: ec.third_exempt_type, // amount | percent
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
  const econUI = (e:EconRow, i:number) => {
    const label = (s:string)=> <label>{s}</label>
    return (
      <div key={i} className="row" style={{borderTop:'1px solid #1f2937', paddingTop:12, marginTop:12}}>
        <div style={{flex:'1 1 220px'}}><div className="badge">{e.category}</div></div>

        {e.category !== 'Conciertos a caché' && e.category !== 'Acciones con marcas' && e.category !== 'Royalties Discográficos' && (
          <>
            <div style={{flex:'1 1 120px'}}>{label('% Artista')}
              <input type="number" value={e.artist_pct} onChange={v=>handleEconGeneral(i,'artist_pct', Number(v.target.value))}/>
            </div>
          </>
        )}

        {e.category === 'Royalties Discográficos' && (
          <>
            <div style={{flex:'1 1 120px'}}>{label('% Artista')}
              <input type="number" value={e.artist_pct} onChange={v=>handleEconGeneral(i,'artist_pct', Number(v.target.value))}/>
            </div>
            <div style={{flex:'1 1 140px'}}>{label('Base Artista')}
              <select value={e.artist_base} onChange={v=>handleEconGeneral(i,'artist_base', v.target.value as any)}>
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
          </>
        )}

        {(e.category !== 'Royalties Discográficos') && (
          <>
            <div style={{flex:'1 1 120px'}}>{label('% Oficina')}
              <input type="number" value={e.office_pct} onChange={v=>handleEconGeneral(i,'office_pct', Number(v.target.value))}/>
            </div>
            <div style={{flex:'1 1 140px'}}>{label('Base Oficina')}
              <select value={e.office_base} onChange={v=>handleEconGeneral(i,'office_base', v.target.value as any)}>
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
            <div style={{flex:'1 1 220px'}}>{label('Exento (Oficina)')}
              <div className="row" style={{gap:8}}>
                <select style={{flex:'0 0 120px'}} value={e.office_exempt_type} onChange={v=>handleEconGeneral(i,'office_exempt_type', v.target.value as any)}>
                  <option value="amount">Importe</option>
                  <option value="percent">%</option>
                </select>
                <input style={{flex:'1 1 auto'}} type="number" value={e.office_exempt_value} onChange={v=>handleEconGeneral(i,'office_exempt_value', Number(v.target.value))}/>
              </div>
            </div>
          </>
        )}

        {/* Base artista sólo aplica si no es caché/marcas en modo oficina y no es booking */}
        {(e.category !== 'Conciertos a caché' && !(e.category==='Acciones con marcas' && brandsOfficeOnly) && e.category!=='Royalties Discográficos') && (
          <div style={{flex:'1 1 140px'}}>
            {label('Base Artista')}
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
    <div className="container">
      <Nav/>
      <h1>Nuevo artista</h1>

      <div className="card">
        <h2>Datos básicos</h2>
        <div className="row">
          <div style={{flex:'1 1 220px'}}>
            <label>Fotografía</label>
            <input type="file" accept="image/*" onChange={e=>setPhotoFile(e.target.files?.[0] ?? null)}/>
          </div>
          <div style={{flex:'1 1 220px'}}>
            <label>Nombre artístico</label>
            <input value={stageName} onChange={e=>setStageName(e.target.value)} placeholder="Ej. El Dobleh"/>
          </div>
          <div style={{flex:'1 1 220px'}}>
            <label>Nombre completo</label>
            <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="Nombre y apellidos"/>
          </div>
          <div style={{flex:'1 1 120px'}}>
            <label>DNI</label>
            <input value={dni} onChange={e=>setDni(e.target.value)} placeholder="DNI/NIF"/>
          </div>
          <div style={{flex:'1 1 160px'}}>
            <label>Fecha de nacimiento</label>
            <input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/>
          </div>
          <div style={{flex:'1 1 160px'}}>
            <label>Tipo de contrato</label>
            <select value={contractType} onChange={e=>{
              const v = e.target.value as 'General'|'Booking'
              setContractType(v)
              // reinicia configuración de terceros según contrato
              setThirds([])
            }}>
              <option value="General">General</option>
              <option value="Booking">Booking</option>
            </select>
          </div>
        </div>

        <div className="row" style={{marginTop:12}}>
          <div style={{flex:'1 1 160px'}}>
            <label>¿Es grupo?</label>
            <select value={isGroup ? 'sí':'no'} onChange={e=>setIsGroup(e.target.value==='sí')}>
              <option>no</option>
              <option>sí</option>
            </select>
          </div>
          <div style={{flex:'1 1 160px'}}>
            <label>Tipo fiscal</label>
            <select value={taxType} onChange={e=>setTaxType(e.target.value as any)}>
              <option value="particular">Particular</option>
              <option value="empresa">Empresa vinculada</option>
            </select>
          </div>
          <div style={{flex:'1 1 260px'}}>
            <label>Nombre fiscal / Empresa</label>
            <input value={taxName} onChange={e=>setTaxName(e.target.value)}/>
          </div>
          <div style={{flex:'1 1 200px'}}>
            <label>NIF/CIF</label>
            <input value={taxId} onChange={e=>setTaxId(e.target.value)}/>
          </div>
          <div style={{flex:'1 1 260px'}}>
            <label>IBAN</label>
            <input value={iban} onChange={e=>setIban(e.target.value)} placeholder="ES.."/>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Contrato (adjuntar)</h2>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>setContractFile(e.target.files?.[0] ?? null)}/>
        <small>Obligatorio</small>
      </div>

      {isGroup && (
        <div className="card">
          <h2>Miembros del grupo</h2>
          <button onClick={addMember}>+ Añadir miembro</button>
          {members.map((m, i)=>(
            <div key={i} className="row" style={{marginTop:8}}>
              <div style={{flex:'1 1 300px'}}>
                <label>Nombre completo</label>
                <input value={m.full_name} onChange={e=>updateMember(i,'full_name', e.target.value)}/>
              </div>
              <div style={{flex:'1 1 200px'}}>
                <label>DNI</label>
                <input value={m.dni} onChange={e=>updateMember(i,'dni', e.target.value)}/>
              </div>
              <div style={{display:'flex', alignItems:'flex-end'}}>
                <button onClick={()=>removeMember(i)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {contractType === 'Booking' ? (
        <div className="card">
          <h2>Condiciones — Booking</h2>
          <div className="row">
            <div style={{flex:'1 1 140px'}}><label>% Oficina</label>
              <input type="number" value={bookingOfficePct} onChange={e=>setBookingOfficePct(Number(e.target.value))}/>
            </div>
            <div style={{flex:'1 1 160px'}}><label>Base</label>
              <select value={bookingOfficeBase} onChange={e=>setBookingOfficeBase(e.target.value as any)}>
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
            <div style={{flex:'1 1 260px'}}><label>Exento comisión</label>
              <div className="row" style={{gap:8}}>
                <select style={{flex:'0 0 120px'}} value={bookingExemptType} onChange={e=>setBookingExemptType(e.target.value as any)}>
                  <option value="amount">Importe</option>
                  <option value="percent">%</option>
                </select>
                <input style={{flex:'1 1 auto'}} type="number" value={bookingExemptValue} onChange={e=>setBookingExemptValue(Number(e.target.value))}/>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <h2>Condiciones — General</h2>

          {/* toggle para Acciones con marcas */}
          <div className="row" style={{marginBottom:8}}>
            <div className="badge">Acciones con marcas: modo</div>
            <select value={brandsOfficeOnly ? 'solo_oficina' : 'modo_actual'} onChange={e=>setBrandsOfficeOnly(e.target.value==='solo_oficina')}>
              <option value="modo_actual">Modo actual (tabla completa)</option>
              <option value="solo_oficina">Solo comisión de oficina</option>
            </select>
          </div>

          {econGeneral.map((e, i)=> econUI(e, i))}
          <small>Puedes dejar % en 0 si no aplica. En "Conciertos a caché", solo % Oficina. En "Royalties Discográficos", solo % Artista + base.</small>
        </div>
      )}

      <div className="card">
        <h2>Terceros</h2>
        <button onClick={addThird}>+ Añadir tercero</button>
        {thirds.map((t, ti)=>(
          <div key={ti} style={{borderTop:'1px solid #1f2937', marginTop:12, paddingTop:12}}>
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
              <div style={{flex:'1 1 220px'}}><label>Contrato (PDF/imagen)</label>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>updateThirdField(ti,'contract_file', e.target.files?.[0] ?? null)}/></div>
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
                      <option value="gross">Bruto</option>
                      <option value="net">Neto</option>
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
                        <option value="amount">Importe</option>
                        <option value="percent">%</option>
                      </select>
                      <input style={{flex:'1 1 auto'}} type="number" value={e.third_exempt_value} onChange={v=>updateThirdEcon(ti,ci,'third_exempt_value', Number(v.target.value))}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{marginTop:8}}>
              <button onClick={()=>removeThird(ti)}>Eliminar tercero</button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <button onClick={onSubmit}>Guardar artista</button>
      </div>
    </div>
  )
}
