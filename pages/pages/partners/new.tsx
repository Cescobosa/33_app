import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'

const BUCKET_PHOTOS = 'artist-photos'
const BUCKET_CONTRACTS = 'contracts'

async function uploadAndSign(bucket:string, file:File) {
  const name = `${Date.now()}-${file.name}`  // permite ñ/acentos
  const { error } = await supabase.storage.from(bucket).upload(name, file)
  if (error) throw error
  const { data, error: e2 } = await supabase.storage.from(bucket).createSignedUrl(name, 60*60*24*365)
  if (e2 || !data) throw e2 || new Error('No signed url')
  return data.signedUrl
}

export default function NewPartner(){
  const [kind, setKind] = useState<'third'|'provider'>('third')
  const [nick, setNick] = useState(''); const [name, setName] = useState('')
  const [logoFile, setLogoFile] = useState<File|null>(null)
  const [email, setEmail] = useState(''); const [phone, setPhone] = useState('')

  const [taxType, setTaxType] = useState<'particular'|'empresa'>('particular')
  const [taxName, setTaxName] = useState(''); const [taxId, setTaxId] = useState('')
  const [addr, setAddr] = useState(''); const [city, setCity] = useState('')
  const [prov, setProv] = useState(''); const [zip, setZip] = useState(''); const [country, setCountry] = useState('')

  const [mName, setMName] = useState(''); const [mPhone, setMPhone] = useState(''); const [mEmail, setMEmail] = useState('')
  const [nName, setNName] = useState(''); const [nEmail, setNEmail] = useState('')

  const [contractName, setContractName] = useState('')
  const [contractDate, setContractDate] = useState('')
  const [contractActive, setContractActive] = useState(true)
  const [contractFile, setContractFile] = useState<File|null>(null)

  const onSubmit = async ()=>{
    try {
      const logo_url = logoFile ? await uploadAndSign(BUCKET_PHOTOS, logoFile) : null
      const { data: tp, error } = await supabase.from('third_parties').insert({
        kind, nick, name, email, phone, logo_url,
        tax_type: taxType, tax_name: taxName || null, tax_id: taxId || null,
        fiscal_address_line: addr || null, fiscal_city: city || null, fiscal_province: prov || null, fiscal_postal_code: zip || null, fiscal_country: country || null,
        manager_name: mName || null, manager_phone: mPhone || null, manager_email: mEmail || null,
        notify_name: nName || null, notify_email: nEmail || null,
        is_active: true
      }).select('*').single()
      if (error) throw error

      if (contractFile && contractName) {
        const file_url = await uploadAndSign(BUCKET_CONTRACTS, contractFile)
        const { error: e2 } = await supabase.from('third_party_contracts').insert({
          third_party_id: tp.id, name: contractName, signed_at: contractDate || null, is_active: contractActive, file_url
        })
        if (e2) throw e2
      }

      alert('Guardado.')
      window.location.href = kind==='third' ? `/partners/thirds/${tp.id}` : `/partners/providers/${tp.id}`
    } catch (e:any) {
      alert(e.message || 'Error')
    }
  }

  return (
    <Layout>
      {/* Cabecera */}
      <div className="module" style={{background:'#fff'}}>
        <h1>Nuevo {kind==='third'?'Tercero':'Proveedor'}</h1>
        <div className="row">
          <div style={{flex:'1 1 200px'}}>
            <label>Tipo</label>
            <select value={kind} onChange={e=>setKind(e.target.value as any)}>
              <option value="third">Tercero</option>
              <option value="provider">Proveedor</option>
            </select>
          </div>
          <div style={{flex:'1 1 220px'}}>
            <label>Logo/Foto</label>
            <input type="file" accept="image/*" onChange={e=>setLogoFile(e.target.files?.[0] ?? null)}/>
          </div>
          <div style={{flex:'1 1 220px'}}>
            <label>Nick</label>
            <input value={nick} onChange={e=>setNick(e.target.value)}/>
          </div>
          <div style={{flex:'1 1 260px'}}>
            <label>Nombre/Compañía</label>
            <input value={name} onChange={e=>setName(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* Datos personales */}
      <div className="module">
        <h2>Datos personales</h2>
        <div className="row">
          <div style={{flex:'1 1 260px'}}><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)}/></div>
          <div style={{flex:'1 1 200px'}}><label>Teléfono</label><input value={phone} onChange={e=>setPhone(e.target.value)}/></div>
        </div>
      </div>

      {/* Datos fiscales */}
      <div className="module">
        <h2>Datos fiscales</h2>
        <div className="row">
          <div style={{flex:'1 1 180px'}}><label>Tipo</label>
            <select value={taxType} onChange={e=>setTaxType(e.target.value as any)}>
              <option value="particular">Particular</option>
              <option value="empresa">Empresa</option>
            </select></div>
          <div style={{flex:'1 1 260px'}}><label>Nombre fiscal</label><input value={taxName} onChange={e=>setTaxName(e.target.value)}/></div>
          <div style={{flex:'1 1 200px'}}><label>NIF/CIF</label><input value={taxId} onChange={e=>setTaxId(e.target.value)}/></div>
        </div>
        <div className="row" style={{marginTop:8}}>
          <div style={{flex:'2 1 300px'}}><label>Domicilio fiscal</label><input value={addr} onChange={e=>setAddr(e.target.value)} placeholder="Calle, número, piso ..."/></div>
          <div style={{flex:'1 1 160px'}}><label>Ciudad</label><input value={city} onChange={e=>setCity(e.target.value)}/></div>
          <div style={{flex:'1 1 160px'}}><label>Provincia</label><input value={prov} onChange={e=>setProv(e.target.value)}/></div>
          <div style={{flex:'1 1 120px'}}><label>C.P.</label><input value={zip} onChange={e=>setZip(e.target.value)}/></div>
          <div style={{flex:'1 1 160px'}}><label>País</label><input value={country} onChange={e=>setCountry(e.target.value)}/></div>
        </div>
        <div className="row" style={{marginTop:8}}>
          <div style={{flex:'1 1 220px'}}><label>Gestor - Nombre</label><input value={mName} onChange={e=>setMName(e.target.value)}/></div>
          <div style={{flex:'1 1 180px'}}><label>Gestor - Teléfono</label><input value={mPhone} onChange={e=>setMPhone(e.target.value)}/></div>
          <div style={{flex:'1 1 240px'}}><label>Gestor - Email</label><input value={mEmail} onChange={e=>setMEmail(e.target.value)}/></div>
        </div>
        <div className="row" style={{marginTop:8}}>
          <div style={{flex:'1 1 240px'}}><label>Notificar liquidaciones a (nombre)</label><input value={nName} onChange={e=>setNName(e.target.value)}/></div>
          <div style={{flex:'1 1 260px'}}><label>Email</label><input value={nEmail} onChange={e=>setNEmail(e.target.value)}/></div>
        </div>
      </div>

      {/* Contrato inicial */}
      <div className="module">
        <h2>Contrato</h2>
        <div className="row">
          <div style={{flex:'1 1 240px'}}><label>Nombre del documento</label><input value={contractName} onChange={e=>setContractName(e.target.value)}/></div>
          <div style={{flex:'1 1 200px'}}><label>Fecha de firma</label><input type="date" value={contractDate} onChange={e=>setContractDate(e.target.value)}/></div>
          <div style={{flex:'1 1 180px'}}><label>¿Vigente?</label>
            <select value={contractActive?'sí':'no'} onChange={e=>setContractActive(e.target.value==='sí')}>
              <option>sí</option><option>no</option>
            </select></div>
          <div style={{flex:'1 1 260px'}}><label>Archivo</label><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>setContractFile(e.target.files?.[0] ?? null)}/></div>
        </div>
      </div>

      <div className="module">
        <button onClick={onSubmit}>Guardar</button>
      </div>
    </Layout>
  )
}
