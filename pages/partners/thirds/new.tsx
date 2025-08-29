import { useState } from 'react'
import Layout from '../../../components/Layout'
import Button from '../../../components/ui/Button'
import { supabase } from '../../../lib/supabaseClient'

const BUCKET_PHOTOS = 'artist-photos'

type RefPerson = { full_name: string; role: string; email: string; phone: string }

async function uploadAndSign(bucket:string, file:File) {
  const name = `${Date.now()}-${file.name}`
  const { error: upErr } = await supabase.storage.from(bucket).upload(name, file)
  if (upErr) throw upErr
  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(name, 60*60*24*365)
  if (signErr || !data) throw signErr || new Error('No signed URL')
  return data.signedUrl
}

export default function NewThird() {
  const [kind] = useState<'third'>('third')
  const [type, setType] = useState<'particular'|'empresa'>('particular')

  const [logoFile, setLogoFile] = useState<File|null>(null)
  const [nick, setNick] = useState('')

  // particulares
  const [fullName, setFullName] = useState('')
  const [dni, setDni] = useState('')

  // empresa
  const [fiscalName, setFiscalName] = useState('')
  const [taxId, setTaxId] = useState('')

  // contacto
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // personas referencia (solo empresa)
  const [refs, setRefs] = useState<RefPerson[]>([])

  const addRef = ()=> setRefs(r=>[...r, { full_name:'', role:'', email:'', phone:'' }])
  const updateRef = (i:number, k:keyof RefPerson, v:string) => { const c=[...refs]; (c[i] as any)[k]=v; setRefs(c) }
  const removeRef = (i:number) => setRefs(r=>r.filter((_,idx)=>idx!==i))

  // validación de duplicados: nick/name, taxId, email
  const checkDuplicate = async (): Promise<string | null> => {
    const valueNick = nick.trim()
    const valueName = type==='particular' ? fullName.trim() : fiscalName.trim()
    const valueTax = (type==='particular' ? dni.trim() : taxId.trim())
    const fields = [valueNick, valueName, valueTax, email.trim()].filter(Boolean).map(v => `nick.ilike.${v},name.ilike.${v},tax_id.ilike.${v},email.ilike.${v}`).join(',')

    if (!fields) return null
    const { data } = await supabase
      .from('third_parties')
      .select('id, nick, name')
      .eq('kind', kind)
      .or(fields)
      .limit(1)
    if (data && data[0]) {
      return `Ya existe: ${data[0].nick || data[0].name}. Selecciónalo en la sección Terceros.`
    }
    return null
  }

  const onSave = async ()=>{
    const dup = await checkDuplicate()
    if (dup) { alert(dup); return }
    try {
      let logo_url: string | null = null
      if (logoFile) logo_url = await uploadAndSign(BUCKET_PHOTOS, logoFile)

      const payload: any = {
        kind,
        logo_url,
        nick: nick || null,
        name: type==='particular' ? (fullName || null) : (fiscalName || null),
        tax_id: type==='particular' ? (dni || null) : (taxId || null),
        email: email || null,
        phone: phone || null,
        is_active: true
      }

      const { data: tp, error } = await supabase.from('third_parties').insert(payload).select('*').single()
      if (error) throw error

      // guardar personas de referencia como "third_party_contacts" (si tienes esa tabla), si no, omítelo:
      for (const r of refs) {
        if (!r.full_name) continue
        await supabase.from('third_party_contacts').insert({
          third_party_id: tp.id,
          full_name: r.full_name, role: r.role || null, email: r.email || null, phone: r.phone || null
        })
      }

      alert('Tercero creado.')
      window.location.href = `/partners/thirds/${tp.id}`
    } catch(e:any) {
      alert(e.message || 'Error guardando')
    }
  }

  return (
    <Layout>
      <div className="module">
        <h1>Nuevo tercero</h1>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: '0 0 220px' }}>
            <label>Foto/Logo</label>
            <input type="file" accept="image/*" onChange={e=>setLogoFile(e.target.files?.[0] ?? null)}/>
          </div>
          <div style={{ flex: '1 1 320px' }}>
            <label>Nick</label>
            <input value={nick} onChange={e=>setNick(e.target.value)} placeholder="Nombre corto/alias" />
          </div>
        </div>
      </div>

      <div className="module">
        <h2>Tipo</h2>
        <div className="row" style={{ gap: 12 }}>
          <select value={type} onChange={e=>setType(e.target.value as any)}>
            <option value="particular">Particular</option>
            <option value="empresa">Empresa</option>
          </select>
        </div>
      </div>

      {type === 'particular' ? (
        <div className="module">
          <h2>Datos personales</h2>
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: '1 1 320px' }}>
              <label>Nombre completo</label>
              <input value={fullName} onChange={e=>setFullName(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label>DNI/NIF</label>
              <input value={dni} onChange={e=>setDni(e.target.value)} />
            </div>
          </div>
        </div>
      ) : (
        <div className="module">
          <h2>Datos fiscales</h2>
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: '1 1 320px' }}>
              <label>Nombre fiscal (empresa)</label>
              <input value={fiscalName} onChange={e=>setFiscalName(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label>NIF/CIF</label>
              <input value={taxId} onChange={e=>setTaxId(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div className="module">
        <h2>Contacto</h2>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex: '1 1 260px' }}>
            <label>Email</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label>Teléfono</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} />
          </div>
        </div>

        {type === 'empresa' && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 16, marginBottom: 8 }}>Personas de referencia</h3>
            <Button tone="ghost" icon="plus" onClick={addRef}>Añadir persona</Button>
            {refs.map((r, i)=>(
              <div key={i} className="row" style={{ gap: 8, marginTop: 8 }}>
                <input placeholder="Nombre completo" value={r.full_name} onChange={e=>updateRef(i,'full_name',e.target.value)}/>
                <input placeholder="Cargo" value={r.role} onChange={e=>updateRef(i,'role',e.target.value)}/>
                <input placeholder="Email" value={r.email} onChange={e=>updateRef(i,'email',e.target.value)}/>
                <input placeholder="Teléfono" value={r.phone} onChange={e=>updateRef(i,'phone',e.target.value)}/>
                <Button tone="ghost" icon="trash" onClick={()=>removeRef(i)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="module">
        <Button icon="save" onClick={onSave}>Guardar</Button>
      </div>
    </Layout>
  )
}
