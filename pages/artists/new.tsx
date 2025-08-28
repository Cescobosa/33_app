import { useState } from 'react'
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
  office_exempt_amount: number
}

const categories = [
  'Conciertos a caché',
  'Conciertos a empresa',
  'Royalties Discográficos',
  'Editorial',
  'Merchandising',
  'Acciones con marcas',
  'Otras acciones'
]

export default function NewArtist() {
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [contractFile, setContractFile] = useState<File|null>(null)

  const [stageName, setStageName] = useState('')
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [isGroup, setIsGroup] = useState(false)
  const [contractType, setContractType] = useState('Management')
  const [taxType, setTaxType] = useState<'particular'|'empresa'>('particular')
  const [taxName, setTaxName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [iban, setIban] = useState('')

  const [members, setMembers] = useState<{full_name:string; dni:string}[]>([])

  const emptyEcon = categories.map(c => ({
    category: c,
    artist_pct: 0,
    office_pct: 0,
    artist_base: 'gross' as const,
    office_base: 'gross' as const,
    office_exempt_amount: 0
  }))
  const [econ, setEcon] = useState<EconRow[]>(emptyEcon)

  type Third = {
    nick: string
    name: string
    tax_id: string
    email: string
    phone: string
    logo_url?: string|null
    econ: { category:string; third_pct:number; third_base:'gross'|'net'; third_exempt_amount:number }[]
  }
  const [thirds, setThirds] = useState<Third[]>([])

  const addMember = () => setMembers(m => [...m, {full_name:'', dni:''}])
  const updateMember = (i:number, k:'full_name'|'dni', v:string) => {
    const copy = [...members]; (copy[i] as any)[k]=v; setMembers(copy)
  }
  const removeMember = (i:number) => setMembers(m => m.filter((_,idx)=>idx!==i))

  const addThird = () => setThirds(t => [...t, {nick:'',name:'',tax_id:'',email:'',phone:'',logo_url:null, econ: categories.map(c=>({category:c, third_pct:0, third_base:'gross', third_exempt_amount:0}))}])
  const updateThirdField = (i:number, k:keyof Third, v:any) => {
    const copy = [...thirds]; (copy[i] as any)[k]=v; setThirds(copy)
  }
  const updateThirdEcon = (ti:number, ci:number, k:'third_pct'|'third_base'|'third_exempt_amount', v:any) => {
    const copy = [...thirds]; (copy[ti].econ[ci] as any)[k]=v; setThirds(copy)
  }
  const removeThird = (i:number) => setThirds(t => t.filter((_,idx)=>idx!==i))

  const handleEconChange = (i:number, k:keyof EconRow, v:any) => {
    const copy=[...econ]; (copy[i] as any)[k]=v; setEcon(copy)
  }

  const onSubmit = async () => {
    let photo_url:string|null = null
    let contract_url:string|null = null
    if (photoFile) {
      const name = `${Date.now()}-${photoFile.name}`
      const { error } = await supabase.storage.from(BUCKET_PHOTOS).upload(name, photoFile)
      if (error) return alert(error.message)
      const { data } = await supabase.storage.from(BUCKET_PHOTOS).createSignedUrl(name, 60*60*24*365) // 1 año
      if (!data) return alert('No se pudo generar URL de la foto')
      photo_url = data.signedUrl
    }
    if (contractFile) {
      const name = `${Date.now()}-${contractFile.name}`
      const { error } = await supabase.storage.from(BUCKET_CONTRACTS).upload(name, contractFile)
      if (error) return alert(error.message)
      const { data } = await supabase.storage.from(BUCKET_CONTRACTS).createSignedUrl(name, 60*60*24*365) // 1 año
      if (!data) return alert('No se pudo generar URL del contrato')
      contract_url = data.signedUrl
    } else {
      return alert('Debes adjuntar el contrato.')
    }

    const { data: artist, error: aerr } = await supabase.from('artists').insert({
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
      contract_url: contract_url
    }).select('*').single()
    if (aerr) return alert(aerr.message)

    for (const m of members) {
      if (m.full_name) {
        const { error } = await supabase.from('artist_members').insert({ artist_id: artist.id, full_name: m.full_name, dni: m.dni || null })
        if (error) return alert(error.message)
      }
    }

    for (const e of econ) {
      const { error } = await supabase.from('artist_economics').insert({
        artist_id: artist.id,
        category: e.category,
        artist_pct: e.artist_pct,
        office_pct: e.office_pct,
        artist_base: e.artist_base,
        office_base: e.office_base,
        office_exempt_amount: e.office_exempt_amount
      })
      if (error) return alert(error.message)
    }

    for (const t of thirds) {
      const { data: tp, error } = await supabase.from('third_parties').insert({
        artist_id: artist.id,
        nick: t.nick,
        name: t.name,
        tax_id: t.tax_id || null,
        email: t.email || null,
        phone: t.phone || null,
        logo_url: t.logo_url || null
      }).select('*').single()
      if (error) return alert(error.message)
      for (const ec of t.econ) {
        const { error: e2 } = await supabase.from('third_party_economics').insert({
          third_party_id: tp.id,
          category: ec.category,
          third_pct: ec.third_pct,
          third_base: ec.third_base,
          third_exempt_amount: ec.third_exempt_amount
        })
        if (e2) return alert(e2.message)
      }
    }

    alert('Artista creado con éxito.')
    window.location.href = '/artists'
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
            <label>Tipo contrato</label>
            <select value={contractType} onChange={e=>setContractType(e.target.value)}>
              <option>Discografico</option>
              <option>Editorial</option>
              <option>Management</option>
              <option>Booking</option>
              <option>Completo</option>
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

      <div className="card">
        <h2>Condiciones económicas</h2>
        {econ.map((e, i)=>(
          <div key={i} className="row" style={{borderTop:'1px solid #1f2937', paddingTop:12, marginTop:12}}>
            <div style={{flex:'1 1 200px'}}><div className="badge">{e.category}</div></div>
            <div style={{flex:'1 1 120px'}}>
              <label>% Artista</label>
              <input type="number" value={e.artist_pct} onChange={v=>handleEconChange(i,'artist_pct', Number(v.target.value))}/>
            </div>
            <div style={{flex:'1 1 120px'}}>
              <label>% Oficina</label>
              <input type="number" value={e.office_pct} onChange={v=>handleEconChange(i,'office_pct', Number(v.target.value))}/>
            </div>
            <div style={{flex:'1 1 140px'}}>
              <label>Base Artista</label>
              <select value={e.artist_base} onChange={v=>handleEconChange(i,'artist_base', v.target.value as any)}>
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
            <div style={{flex:'1 1 140px'}}>
              <label>Base Oficina</label>
              <select value={e.office_base} onChange={v=>handleEconChange(i,'office_base', v.target.value as any)}>
                <option value="gross">Bruto</option>
                <option value="net">Neto</option>
              </select>
            </div>
            <div style={{flex:'1 1 180px'}}>
              <label>Exento comisión (Oficina)</label>
              <input type="number" value={e.office_exempt_amount} onChange={v=>handleEconChange(i,'office_exempt_amount', Number(v.target.value))}/>
            </div>
          </div>
        ))}
        <small>Puedes dejar % en 0 si no aplica.</small>
      </div>

      <div className="card">
        <h2>Terceros</h2>
        <button onClick={addThird}>+ Añadir tercero</button>
        {thirds.map((t, ti)=>(
          <div key={ti} style={{borderTop:'1px solid #1f2937', marginTop:12, paddingTop:12}}>
            <div className="row">
              <div style={{flex:'1 1 200px'}}>
                <label>Nick</label>
                <input value={t.nick} onChange={e=>updateThirdField(ti,'nick', e.target.value)}/>
              </div>
              <div style={{flex:'1 1 260px'}}>
                <label>Nombre/Compañía</label>
                <input value={t.name} onChange={e=>updateThirdField(ti,'name', e.target.value)}/>
              </div>
              <div style={{flex:'1 1 200px'}}>
                <label>NIF/CIF</label>
                <input value={t.tax_id} onChange={e=>updateThirdField(ti,'tax_id', e.target.value)}/>
              </div>
              <div style={{flex:'1 1 200px'}}>
                <label>Email liquidaciones</label>
                <input value={t.email} onChange={e=>updateThirdField(ti,'email', e.target.value)}/>
              </div>
              <div style={{flex:'1 1 160px'}}>
                <label>Teléfono</label>
                <input value={t.phone} onChange={e=>updateThirdField(ti,'phone', e.target.value)}/>
              </div>
            </div>
            <div style={{marginTop:8}}>
              <h3 style={{fontSize:16}}>Condiciones del tercero</h3>
              {t.econ.map((e, ci)=>(
                <div key={ci} className="row" style={{marginTop:6}}>
                  <div style={{flex:'1 1 220px'}}><div className="badge">{e.category}</div></div>
                  <div style={{flex:'1 1 120px'}}>
                    <label>% Tercero</label>
                    <input type="number" value={e.third_pct} onChange={v=>updateThirdEcon(ti,ci,'third_pct', Number(v.target.value))}/>
                  </div>
                  <div style={{flex:'1 1 140px'}}>
                    <label>Base</label>
                    <select value={e.third_base} onChange={v=>updateThirdEcon(ti,ci,'third_base', v.target.value)}>
                      <option value="gross">Bruto</option>
                      <option value="net">Neto</option>
                    </select>
                  </div>
                  <div style={{flex:'1 1 200px'}}>
                    <label>Exento comisión (€)</label>
                    <input type="number" value={e.third_exempt_amount} onChange={v=>updateThirdEcon(ti,ci,'third_exempt_amount', Number(v.target.value))}/>
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
