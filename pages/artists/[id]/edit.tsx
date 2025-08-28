import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import Nav from '../../../components/Nav'

const BUCKET_PHOTOS = 'artist-photos'
const BUCKET_CONTRACTS = 'contracts'

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
  const s = iban.replace(/\s+/g,'').toUpperCase()
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{9,30}$/.test(s)) return false
  const rearr = s.slice(4) + s.slice(0,4)
  const converted = rearr.replace(/[A-Z]/g, ch => (ch.charCodeAt(0)-55).toString())
  let remainder = 0
  for (let i=0;i<converted.length;i+=7) {
    const part = remainder.toString() + converted.substr(i,7)
    remainder = parseInt(part,10) % 97
  }
  return remainder === 1
}
const pctOK = (n:number) => n>=0 && n<=100

export default function EditArtist() {
  const router = useRouter()
  const { id } = router.query as { id: string }

  // artist
  const [artist, setArtist] = useState<any>(null)
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [contractFile, setContractFile] = useState<File|null>(null)

  // economics
  const [econ, setEcon] = useState<any[]>([])

  // members
  const [members, setMembers] = useState<any[]>([])

  // thirds
  const [thirds, setThirds] = useState<any[]>([])

  const load = async () => {
    const { data: a } = await supabase.from('artists').select('*').eq('id', id).single()
    setArtist(a)
    const { data: e } = await supabase.from('artist_economics').select('*').eq('artist_id', id)
    setEcon(e ?? [])
    const { data: m } = await supabase.from('artist_members').select('*').eq('artist_id', id)
    setMembers(m ?? [])
    const { data: t } = await supabase.from('third_parties').select('*, third_party_economics(*)').eq('artist_id', id)
    setThirds(t ?? [])
  }

  useEffect(()=>{ if(id) load() }, [id])

  const updateMember = (i:number, k:'full_name'|'dni', v:string) => {
    const copy=[...members]; (copy[i] as any)[k]=v; setMembers(copy)
  }
  const addMember = ()=> setMembers(m=>[...m, {full_name:'', dni:''}])
  const removeMember = (i:number)=> setMembers(m=>m.filter((_:any,idx:number)=>idx!==i))

  const updateEcon = (i:number, k:string, v:any) => { const c=[...econ]; c[i][k]=v; setEcon(c) }

  const addThird = ()=> setThirds(t=>[...t, {
    nick:'', name:'', tax_id:'', email:'', phone:'',
    logo_url:null, contract_url:null, is_active:true,
    econ: (artist.contract_type==='Booking'
      ? [{ category:'Booking', third_pct:0, third_base:'gross', base_scope:'total', third_exempt_type:'amount', third_exempt_value:0 }]
      : GENERAL_CATEGORIES.map(c=>({category:c, third_pct:0, third_base:'gross', base_scope:'total', third_exempt_type:'amount', third_exempt_value:0}))
    )
  }])
  const updateThirdField = (ti:number, k:string, v:any)=>{ const c=[...thirds]; c[ti][k]=v; setThirds(c) }
  const updateThirdEcon = (ti:number, ci:number, k:string, v:any)=>{ const c=[...thirds]; c[ti].econ[ci][k]=v; setThirds(c) }
  const removeThird = (ti:number)=> setThirds(ts=>ts.filter((_:any,idx:number)=>idx!==ti))

  async function uploadAndSign(bucket:string, file:File): Promise<string> {
    const name = `${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from(bucket).upload(name, file)
    if (upErr) throw upErr
    const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(name, 60*60*24*365)
    if (signErr || !data) throw signErr || new Error('No signed URL')
    return data.signedUrl
  }

  const validateAll = () => {
    if (!artist.stage_name?.trim()) return 'Pon el nombre artístico.'
    if (artist.iban && !validateIBAN(artist.iban)) return 'IBAN no válido. Introduce el IBAN completo.'
    if (artist.contract_type==='Booking') {
      const row = econ.find((r:any)=>r.category==='Booking') || {office_pct:0, office_exempt_type:'amount', office_exempt_value:0}
      if (!pctOK(row.office_pct)) return 'En Booking, % Oficina debe estar entre 0 y 100.'
      if (row.office_exempt_type==='percent' && !pctOK(row.office_exempt_value)) return 'En Booking, Exento (%) debe estar entre 0 y 100.'
    } else {
      for (const r of econ) {
        if (r.category==='Conciertos a caché') {
          if (!pctOK(r.office_pct)) return 'En Caché, % Oficina debe estar entre 0 y 100.'
          if (r.office_exempt_type==='percent' && !pctOK(r.office_exempt_value)) return 'Exento (%) en Caché debe estar entre 0 y 100.'
        } else if (r.category==='Royalties Discográficos') {
          if (!pctOK(r.artist_pct)) return 'En Royalties, % Artista debe estar entre 0 y 100.'
        } else {
          if (!pctOK(r.artist_pct)) return `En ${r.category}, % Artista debe estar entre 0 y 100.`
          if (!pctOK(r.office_pct)) return `En ${r.category}, % Oficina debe estar entre 0 y 100.`
          if (r.office_exempt_type==='percent' && !pctOK(r.office_exempt_value)) return `En ${r.category}, Exento (%) debe estar entre 0 y 100.`
        }
      }
    }
    for (const t of thirds) {
      for (const e of (t.econ||[])) {
        if (!pctOK(e.third_pct)) return 'En Terceros, % debe estar entre 0 y 100.'
        if (e.third_exempt_type==='percent' && !pctOK(e.third_exempt_value)) return 'En Terceros, Exento (%) debe estar entre 0 y 100.'
      }
    }
    return null
  }

  const onSave = async () => {
    const msg = validateAll()
    if (msg) return alert(msg)
    try {
      // uploads opcionales
      let photo_url = artist.photo_url
      let contract_url = artist.contract_url
      if (photoFile) photo_url = await uploadAndSign(BUCKET_PHOTOS, photoFile)
      if (contractFile) contract_url = await uploadAndSign(BUCKET_CONTRACTS, contractFile)

      // update artist
      const { error: aerr } = await supabase.from('artists').update({
        stage_name: artist.stage_name,
        full_name: artist.full_name || null,
        dni: artist.dni || null,
        birth_date: artist.birth_date || null,
        is_group: artist.is_group || false,
        contract_type: artist.contract_type,
        photo_url,
        tax_type: artist.tax_type,
        tax_name: artist.tax_type==='particular' ? (artist.full_name || null) : (artist.tax_name || null),
        tax_id: artist.tax_type==='particular' ? (artist.dni || null) : (artist.tax_id || null),
        iban: artist.iban || null,
        contract_url
      }).eq('id', id)
      if (aerr) throw aerr

      // replace members
      await supabase.from('artist_members').delete().eq('artist_id', id)
      for (const m of members) {
        if (m.full_name) {
          const { error } = await supabase.from('artist_members').insert({ artist_id: id, full_name: m.full_name, dni: m.dni || null })
          if (error) throw error
        }
      }

      // replace economics
      await supabase.from('artist_economics').delete().eq('artist_id', id)
      for (const r of econ) {
        const payload:any = {
          artist_id: id,
          category: r.category,
          artist_pct: r.artist_pct || 0,
          office_pct: r.office_pct || 0,
          artist_base: r.artist_base || 'gross',
          office_base: r.office_base || 'gross',
          office_exempt_type: r.office_exempt_type || 'amount',
          office_exempt_value: r.office_exempt_value || 0
        }
        if (r.category==='Acciones con marcas' && r.brands_mode) payload.brands_mode = r.brands_mode
        const { error } = await supabase.from('artist_economics').insert(payload)
        if (error) throw error
      }

      // replace thirds (simple y fiable para piloto)
      const { data: existing } = await supabase.from('third_parties').select('id').eq('artist_id', id)
      for (const row of (existing||[])) {
        await supabase.from('third_party_economics').delete().eq('third_party_id', row.id)
      }
      await supabase.from('third_parties').delete().eq('artist_id', id)

      for (const t of thirds) {
        let logo_url = t.logo_url || null
        let t_contract_url = t.contract_url || null
        if ((t as any).logo_file) logo_url = await uploadAndSign(BUCKET_PHOTOS, (t as any).logo_file)
        if ((t as any).contract_file) t_contract_url = await uploadAndSign(BUCKET_CONTRACTS, (t as any).contract_file)

        const { data: tp, error } = await supabase.from('third_parties').insert({
          artist_id: id,
          nick: t.nick,
          name: t.name,
          tax_id: t.tax_id || null,
          email: t.email || null,
          phone: t.phone || null,
          logo_url,
          contract_url: t_contract_url,
          is_active: t.is_active !== false
        }).select('*').single()
        if (error) throw error

        for (const ec of (t.econ||[])) {
          const { error: e2 } = await supabase.from('third_party_economics').insert({
            third_party_id: tp.id,
            category: ec.category,
            third_pct: ec.third_pct || 0,
            third_base: ec.third_base || 'gross',
            base_scope: ec.base_scope || 'total',
            third_exempt_type: ec.third_exempt_type || 'amount',
            third_exempt_value: ec.third_exempt_value || 0
          })
          if (e2) throw e2
        }
      }

      alert('Cambios guardados.')
      router.push(`/artists/${id}`)
    } catch (e:any) {
      alert(e.message || 'Error guardando')
    }
  }

  if (!artist) return <div className="container"><Nav/><div className="card">Cargando…</div></div>

  return (
    <div className="container">
      <Nav/>
      <h1>Editar: {artist.stage_name}</h1>

      <div className="card">
        <h2>Datos básicos</h2>
        <div className="row">
          <div style={{flex:'1 1 220px'}}>
            <label>Fotografía</label>
            <input type="file" accept="image/*" onChange={e=>setPhotoFile(e.target.files?.[0] ?? null)}/>
          </div>
          <div style={{flex:'1 1 220px'}}>
            <label>Nombre artístico</label>
            <input value={artist.stage_name||''} onChange={e=>setArtist({...artist, stage_name:e.target.value})}/>
          </div>
          <div style={{flex:'1 1 220px'}}>
            <label>Nombre completo</label>
            <input value={artist.full_name||''} onChange={e=>setArtist({...artist, full_name:e.target.value})}/>
          </div>
          <div style={{flex:'1 1 120px'}}>
            <label>DNI</label>
            <input value={artist.dni||''} onChange={e=>setArtist({...artist, dni:e.target.value})}/>
          </div>
          <div style={{flex:'1 1 160px'}}>
            <label>Fecha de nacimiento</label>
            <input type="date" value={artist.birth_date||''} onChange={e=>setArtist({...artist, birth_date:e.target.value})}/>
          </div>
          <div style={{flex:'1 1 160px'}}>
            <label>Tipo contrato</label>
            <select value={artist.contract_type} onChange={e=>{ setArtist({...artist, contract_type:e.target.value}); }}>
              <option value="General">General</option>
              <option value="Booking">Booking</option>
            </select>
          </div>
        </div>

        <div className="row" style={{marginTop:12}}>
          <div style={{flex:'1 1 160px'}}>
            <label>¿Es grupo?</label>
            <select value={artist.is_group ? 'sí':'no'} onChange={e=>setArtist({...artist, is_group:e.target.value==='sí'})}>
              <option>no</option><option>sí</option>
            </select>
          </div>
          <div style={{flex:'1 1 160px'}}>
            <label>Tipo fiscal</label>
            <select value={artist.tax_type} onChange={e=>setArtist({...artist, tax_type:e.target.value})}>
              <option value="particular">Particular</option>
              <option value="empresa">Empresa vinculada</option>
            </select>
          </div>
          <div style={{flex:'1 1 260px'}}>
            <label>Nombre fiscal / Empresa</label>
            <input value={artist.tax_type==='particular' ? (artist.full_name||'') : (artist.tax_name||'')}
                   onChange={e=>setArtist({...artist, tax_name:e.target.value})}
                   disabled={artist.tax_type==='particular'}/>
          </div>
          <div style={{flex:'1 1 200px'}}>
            <label>NIF/CIF</label>
            <input value={artist.tax_type==='particular' ? (artist.dni||'') : (artist.tax_id||'')}
                   onChange={e=>setArtist({...artist, tax_id:e.target.value})}
                   disabled={artist.tax_type==='particular'}/>
          </div>
          <div style={{flex:'1 1 260px'}}>
            <label>IBAN</label>
            <input value={artist.iban||''} onChange={e=>setArtist({...artist, iban:e.target.value})}/>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Contrato (reemplazar)</h2>
        <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>setContractFile(e.target.files?.[0] ?? null)}/>
      </div>

      {artist.is_group && (
        <div className="card">
          <h2>Miembros</h2>
          <button onClick={addMember}>+ Añadir miembro</button>
          {members.map((m:any, i:number)=>(
            <div key={i} className="row" style={{marginTop:8}}>
              <div style={{flex:'1 1 300px'}}><label>Nombre completo</label>
                <input value={m.full_name||''} onChange={e=>updateMember(i,'full_name', e.target.value)}/></div>
              <div style={{flex:'1 1 200px'}}><label>DNI</label>
                <input value={m.dni||''} onChange={e=>updateMember(i,'dni', e.target.value)}/></div>
              <div style={{display:'flex', alignItems:'flex-end'}}><button onClick={()=>removeMember(i)}>Eliminar</button></div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Condiciones económicas</h2>
        {econ.map((r:any, i:number)=>(
          <div key={i} className="row" style={{borderTop:'1px solid #1f2937', paddingTop:12, marginTop:12}}>
            <div style={{flex:'1 1 220px'}}><div className="badge">{r.category}</div></div>

            {r.category==='Acciones con marcas' && (
              <div style={{flex:'1 1 220px'}}>
                <label>Modo</label>
                <select value={r.brands_mode || 'split'} onChange={e=>updateEcon(i, 'brands_mode', e.target.value)}>
                  <option value="office_only">Comisión de oficina</option>
                  <option value="split">Reparto porcentajes</option>
                </select>
              </div>
            )}

            {!(r.category==='Conciertos a caché' || (r.category==='Acciones con marcas' && r.brands_mode==='office_only') || r.category==='Royalties Discográficos') && (
              <div style={{flex:'1 1 120px'}}><label>% Artista</label>
                <input type="number" value={r.artist_pct||0} onChange={e=>updateEcon(i,'artist_pct', Number(e.target.value))}/></div>
            )}
            {r.category==='Royalties Discográficos' && (
              <>
                <div style={{flex:'1 1 120px'}}><label>% Artista</label>
                  <input type="number" value={r.artist_pct||0} onChange={e=>updateEcon(i,'artist_pct', Number(e.target.value))}/></div>
                <div style={{flex:'1 1 140px'}}><label>Base Artista</label>
                  <select value={r.artist_base||'gross'} onChange={e=>updateEcon(i,'artist_base', e.target.value)}>
                    <option value="gross">Bruto</option><option value="net">Neto</option>
                  </select></div>
              </>
            )}

            {r.category!=='Royalties Discográficos' && (
              <>
                <div style={{flex:'1 1 120px'}}><label>% Oficina</label>
                  <input type="number" value={r.office_pct||0} onChange={e=>updateEcon(i,'office_pct', Number(e.target.value))}/></div>
                <div style={{flex:'1 1 140px'}}><label>Base Oficina</label>
                  <select value={r.office_base||'gross'} onChange={e=>updateEcon(i,'office_base', e.target.value)}>
                    <option value="gross">Bruto</option><option value="net">Neto</option>
                  </select></div>
                <div style={{flex:'1 1 220px'}}><label>Exento (Oficina)</label>
                  <div className="row" style={{gap:8}}>
                    <select style={{flex:'0 0 120px'}} value={r.office_exempt_type||'amount'} onChange={e=>updateEcon(i,'office_exempt_type', e.target.value)}>
                      <option value="amount">Importe</option><option value="percent">%</option>
                    </select>
                    <input style={{flex:'1 1 auto'}} type="number" value={r.office_exempt_value||0} onChange={e=>updateEcon(i,'office_exempt_value', Number(e.target.value))}/>
                  </div></div>
              </>
            )}

            {!(r.category==='Conciertos a caché' || (r.category==='Acciones con marcas' && r.brands_mode==='office_only') || r.category==='Royalties Discográficos') && (
              <div style={{flex:'1 1 140px'}}><label>Base Artista</label>
                <select value={r.artist_base||'gross'} onChange={e=>updateEcon(i,'artist_base', e.target.value)}>
                  <option value="gross">Bruto</option><option value="net">Neto</option>
                </select></div>
            )}
          </div>
        ))}
      </div>

      <div className="card" id="thirds">
        <h2>Terceros</h2>
        <button onClick={addThird}>+ Añadir tercero</button>
        {thirds.map((t:any, ti:number)=>(
          <div key={ti} style={{borderTop:'1px solid #1f2937', marginTop:12, paddingTop:12}}>
            <div className="row">
              <div style={{flex:'1 1 200px'}}><label>Nick</label>
                <input value={t.nick||''} onChange={e=>updateThirdField(ti,'nick', e.target.value)}/></div>
              <div style={{flex:'1 1 260px'}}><label>Nombre/Compañía</label>
                <input value={t.name||''} onChange={e=>updateThirdField(ti,'name', e.target.value)}/></div>
              <div style={{flex:'1 1 200px'}}><label>NIF/CIF</label>
                <input value={t.tax_id||''} onChange={e=>updateThirdField(ti,'tax_id', e.target.value)}/></div>
              <div style={{flex:'1 1 200px'}}><label>Email liquidaciones</label>
                <input value={t.email||''} onChange={e=>updateThirdField(ti,'email', e.target.value)}/></div>
              <div style={{flex:'1 1 160px'}}><label>Teléfono</label>
                <input value={t.phone||''} onChange={e=>updateThirdField(ti,'phone', e.target.value)}/></div>
              <div style={{flex:'1 1 160px'}}><label>Activo</label>
                <select value={t.is_active!==false ? 'sí':'no'} onChange={e=>updateThirdField(ti,'is_active', e.target.value==='sí')}>
                  <option>sí</option><option>no</option>
                </select></div>
              <div style={{flex:'1 1 220px'}}><label>Logo (nuevo)</label>
                <input type="file" accept="image/*" onChange={e=>updateThirdField(ti,'logo_file', e.target.files?.[0] ?? null)}/></div>
              <div style={{flex:'1 1 220px'}}><label>Contrato (nuevo)</label>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={e=>updateThirdField(ti,'contract_file', e.target.files?.[0] ?? null)}/></div>
            </div>

            <div style={{marginTop:8}}>
              <h3 style={{fontSize:16}}>Condiciones del tercero</h3>
              {(t.econ||[]).map((e:any, ci:number)=>(
                <div key={ci} className="row" style={{marginTop:6}}>
                  <div style={{flex:'1 1 220px'}}><div className="badge">{e.category}</div></div>
                  <div style={{flex:'1 1 120px'}}><label>%</label>
                    <input type="number" value={e.third_pct||0} onChange={v=>updateThirdEcon(ti,ci,'third_pct', Number(v.target.value))}/></div>
                  <div style={{flex:'1 1 140px'}}><label>Base</label>
                    <select value={e.third_base||'gross'} onChange={v=>updateThirdEcon(ti,ci,'third_base', v.target.value)}>
                      <option value="gross">Bruto</option><option value="net">Neto</option>
                    </select></div>
                  <div style={{flex:'1 1 180px'}}><label>Ámbito base</label>
                    <select value={e.base_scope||'total'} onChange={v=>updateThirdEcon(ti,ci,'base_scope', v.target.value)}>
                      <option value="total">Total generado</option>
                      <option value="office">Ingresos/beneficio de oficina</option>
                      <option value="artist">Ingresos/beneficio de artista</option>
                    </select></div>
                  <div style={{flex:'1 1 240px'}}><label>Exento</label>
                    <div className="row" style={{gap:8}}>
                      <select style={{flex:'0 0 120px'}} value={e.third_exempt_type||'amount'} onChange={v=>updateThirdEcon(ti,ci,'third_exempt_type', v.target.value)}>
                        <option value="amount">Importe</option><option value="percent">%</option>
                      </select>
                      <input style={{flex:'1 1 auto'}} type="number" value={e.third_exempt_value||0} onChange={v=>updateThirdEcon(ti,ci,'third_exempt_value', Number(v.target.value))}/>
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
        <button onClick={onSave}>Guardar cambios</button>
      </div>
    </div>
  )
}
