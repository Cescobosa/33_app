// pages/partners/providers/[id]/edit.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../../lib/supabaseClient'
import Layout from '../../../../components/Layout'

const BUCKET_PHOTOS = 'artist-photos'
const BUCKET_CONTRACTS = 'contracts'

async function uploadAndSign(bucket:string, file:File) {
  const name = `${Date.now()}-${file.name}` // permite ñ/acentos
  const { error: upErr } = await supabase.storage.from(bucket).upload(name, file)
  if (upErr) throw upErr
  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(name, 60*60*24*365)
  if (signErr || !data) throw signErr || new Error('No signed URL')
  return data.signedUrl
}

export default function EditProvider(){
  const { query:{id} } = useRouter()
  const router = useRouter()

  const [row, setRow] = useState<any>(null)
  const [logoFile, setLogoFile] = useState<File|null>(null)
  const [contracts, setContracts] = useState<any[]>([])

  // Nuevo contrato
  const [newName, setNewName] = useState('')
  thead
  const [newDate, setNewDate] = useState('')
  const [newActive, setNewActive] = useState(true)
  const [newFile, setNewFile] = useState<File|null>(null)

  const load = async ()=>{
    const { data: t } = await supabase.from('third_parties').select('*').eq('id', id).eq('kind','provider').single()
    setRow(t||null)
    const { data: c } = await supabase.from('third_party_contracts').select('*').eq('third_party_id', id).order('signed_at', {ascending:false})
    setContracts(c||[])
  }
  useEffect(()=>{ if(id) load() }, [id])

  const save = async ()=>{
    try {
      let logo_url = row.logo_url || null
      if (logoFile) logo_url = await uploadAndSign(BUCKET_PHOTOS, logoFile)
      const { error } = await supabase.from('third_parties').update({
        nick: row.nick || null,
        name: row.name || null,
        email: row.email || null,
        phone: row.phone || null,
        logo_url,
        tax_type: row.tax_type || null,
        tax_name: row.tax_name || null,
        tax_id: row.tax_id || null,
        fiscal_address_line: row.fiscal_address_line || null,
        fiscal_city: row.fiscal_city || null,
        fiscal_province: row.fiscal_province || null,
        fiscal_postal_code: row.fiscal_postal_code || null,
        fiscal_country: row.fiscal_country || null,
        manager_name: row.manager_name || null,
        manager_phone: row.manager_phone || null,
        manager_email: row.manager_email || null,
        notify_name: row.notify_name || null,
        notify_email: row.notify_email || null,
      }).eq('id', id)
      if (error) throw error

      if (newFile && newName.trim()) {
        const file_url = await uploadAndSign(BUCKET_CONTRACTS, newFile)
        const { error: e2 } = await supabase.from('third_party_contracts').insert({
          third_party_id: id, name: newName, signed_at: newDate || null, is_active: newActive, file_url
        })
        if (e2) throw e2
      }

      alert('Guardado.')
      router.push(`/partners/providers/${id}`)
    } catch (e:any) {
      alert(e.message || 'Error guardando')
    }
  }

  const deleteLogo = async ()=>{
    const ok = confirm('¿Eliminar logo actual?')
    if (!ok) return
    const { error } = await supabase.from('third_parties').update({ logo_url: null }).eq('id', id)
    if (error) return alert(error.message)
    load()
  }

  const toggleContractActive = async (cid:string, value:boolean)=>{
    const { error } = await supabase.from('third_party_contracts').update({ is_active: value }).eq('id', cid)
    if (error) return alert(error.message)
    load()
  }

  const replaceContractFile = async (cid:string, file:File|null)=>{
    if (!file) return
    try {
      const file_url = await uploadAndSign(BUCKET_CONTRACTS, file)
      const { error } = await supabase.from('third_party_contracts').update({ file_url }).eq('id', cid)
      if (error) throw error
      load()
    } catch (e:any) {
      alert(e.message || 'Error reemplazando archivo')
    }
  }

  const deleteContract = async (cid:string)=>{
    const input = prompt('Escribe ELIMINAR para borrar este contrato:')
    if (input !== 'ELIMINAR') return
    const { error } = await supabase.from('third_party_contracts').delete().eq('id', cid)
    if (error) return alert(error.message)
    load()
  }

  if (!row) return <Layout><div className="module">Cargando…</div></Layout>

  return (
    <Layout>
      {/* Cabecera */}
      <div className="module" style={{background:'#fff'}}>
        <h1>Editar proveedor</h1>
        <div className="row" style={{alignItems:'center'}}>
          {row.logo_url ? (
            <div className="row" style={{alignItems:'center', gap:8}}>
              <img src={row.logo_url} style={{width:60,height:60,borderRadius:12,objectFit:'cover'}}/>
              <button onClick={deleteLogo}>Borrar logo</button>
            </div>
          ) : <small>Sin logo</small>}
          <div style={{flex:'1 1 260px'}}>
            <label>Logo (reemplazar)</label>
            <input type="file" accept="image/*" onChange={e=>setLogoFile(e.target.files?.[0] ?? null)}/>
          </div>
        </div>
      </div>

      {/* Datos personales */}
      <div className="module">
        <h2>Datos personales</h2>
        <div className="row">
          <div style={{flex:'1 1 220px'}}><label>Nick</label><input value={row.nick||''} onChange={e=>setRow({...row, nick:e.target.value})}/></div>
          <div style={{flex:'2 1 260px'}}><label>Nombre/Compañía</label><input value={row.name||''} onChange={e=>setRow({...row, name:e.target.value})}/></div>
        </div>
        <div className="row" style={{marginTop:8}}>
          <div style={{flex:'2 1 260px'}}><label>Email</label><input value={row.email||''} onChange={e=>setRow({...row, email:e.target.value})}/></div>
          <div style={{flex:'1 1 200px'}}><label>Teléfono</label><input value={row.phone||''} onChange={e=>setRow({...row, phone:e.target.value})}/></div>
        </div>
      </div>

      {/* Datos fiscales */}
      <div className="module">
        <h2>Datos fiscales</h2>
        <div className="row">
          <div style={{flex:'1 1 160px'}}><label>Tipo</label>
            <select value={row.tax_type || 'particular'} onChange={e=>setRow({...row, tax_type:e.target.value})}>
              <option value="particular">Particular</option>
              <option value="empresa">Empresa</option>
            </select></div>
          <div style={{flex:'2 1 260px'}}><label>Nombre fiscal</label><input value={row.tax_name||''} onChange={e=>setRow({...row, tax_name:e.target.value})}/></div>
          <div style={{flex:'1 1 200px'}}><label>NIF/CIF</label><input value={row.tax_id||''} onChange={e=>setRow({...row, tax_id:e.target.value})}/></div>
        </div>
        <div className="row" style={{marginTop:8}}>
          <div style={{flex:'3 1 320px'}}><label>Domicilio fiscal</label><input value={row.fiscal_address_line||''} onChange={e=>setRow({...row, fiscal_address_line:e.target.value})}/></div>
          <div style={{flex:'1 1 160px'}}><label>Ciudad</label><input value={row.fiscal_city||''} onChange={e=>setRow({...row, fiscal_city:e.target.value})}/></div>
          <div style={{flex:'1 1 160px'}}><label>Provincia</label><input value={row.fiscal_province||''} onChange={e=>setRow({...row, fiscal_province:e.target.value})}/></div>
          <div style={{flex:'1 1 120px'}}><label>C.P.</label><input value={row.fiscal_postal_code||''} onChange={e=>setRow({...row, fiscal_postal_code:e.target.value})}/></div>
          <div style={{flex:'1 1 160px'}}><label>País</label><input value={row.fiscal_country||''} onChange={e=>setRow({...row, fiscal_country:e.target.value})}/></div>
        </div>
        <div className="row" style={{marginTop:8}}>
          <div style={{flex:'1 1 220px'}}><label>Gestor - Nombre</label><input value={row.manager_name||''} onChange={e=>setRow({...row, manager_name:e.target.value})}/></div>
          <div style={{flex:'1 1 180px'}}><label>Gestor - Teléfono</label><input value={row.manager_phone||''} onChange={e=>setRow({...row, manager_phone:e.target.value})}/></div>
          <div style={{flex:'1 1 240px'}}><label>Gestor - Email</label><input value={row.manager_email||''} onChange={e=>setRow({...row, manager_email:e.target.value})}/></div>
        </div>
        <div className="row" style={{marginTop:8}}>
          <div style={{flex:'1 1 240px'}}><label>Notificar liquidaciones a (nombre)</label><input value={row.notify_name||''} onChange={e=>setRow({...row, notify_name:e.target.value})}/></div>
          <div style={{flex:'1 1 260px'}}><label>Email</label><input value={row.notify_email||''} onChange={e=>setRow({...row, notify_email:e.target.value})}/></div>
        </div>
      </div>

      {/* Contratos */}
      <div className="module">
        <h2>Contratos</h2>

        {contracts.length===0 ? <small>—</small> : contracts.map((c:any)=>(
          <div key={c.id} className="card" style={{marginTop:8}}>
            <div className="row" style={{alignItems:'center'}}>
              <div className="badge" style={{background:c.is_active?'#e8fff0':'#f1f5f9', borderColor:c.is_active?'#86efac':'#e5e7eb'}}>
                {c.is_active ? 'VIGENTE' : '—'}
              </div>
              <div style={{marginLeft:8, fontWeight:700}}>{c.name}</div>
              {c.signed_at && <div style={{marginLeft:8}}>{c.signed_at}</div>}
              <a href={c.file_url} target="_blank" rel="noreferrer" style={{marginLeft:'auto'}}>📄 Ver</a>
            </div>
            <div className="row" style={{marginTop:8}}>
              <div style={{flex:'1 1 200px'}}>
                <label>Reemplazar archivo</label>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>replaceContractFile(c.id, e.target.files?.[0] ?? null)}/>
              </div>
              <div style={{display:'flex', gap:8, alignItems:'flex-end'}}>
                <button onClick={()=>toggleContractActive(c.id, !c.is_active)}>{c.is_active ? 'Marcar NO vigente' : 'Marcar vigente'}</button>
                <button onClick={()=>deleteContract(c.id)}>Eliminar</button>
              </div>
            </div>
          </div>
        ))}

        <div className="card" style={{marginTop:12}}>
          <h3>+ Añadir contrato</h3>
          <div className="row">
            <div style={{flex:'1 1 240px'}}><label>Nombre</label><input value={newName} onChange={e=>setNewName(e.target.value)}/></div>
            <div style={{flex:'1 1 200px'}}><label>Fecha firma</label><input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}/></div>
            <div style={{flex:'1 1 160px'}}><label>¿Vigente?</label>
              <select value={newActive?'sí':'no'} onChange={e=>setNewActive(e.target.value==='sí')}>
                <option>sí</option><option>no</option>
              </select></div>
            <div style={{flex:'2 1 260px'}}><label>Archivo</label><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>setNewFile(e.target.files?.[0] ?? null)}/></div>
          </div>
        </div>
      </div>

      <div className="module">
        <button onClick={save}>Guardar cambios</button>
      </div>
    </Layout>
  )
}
