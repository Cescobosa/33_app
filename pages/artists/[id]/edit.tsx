import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import Layout from '../../../components/Layout'
import { validateIBAN, pctOK } from '../../../utils/validators'
import ContractUploader from '../../../components/ContractUploader'

const BUCKET_PHOTOS = 'artist-photos'
const BUCKET_CONTRACTS = 'contracts'

async function uploadAndSign(bucket:string, file:File) {
  const name = `${Date.now()}-${file.name}`
  const { error: upErr } = await supabase.storage.from(bucket).upload(name, file)
  if (upErr) throw upErr
  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(name, 60*60*24*365)
  if (signErr || !data) throw signErr || new Error('No signed URL')
  return data.signedUrl
}

export default function EditArtist() {
  const router = useRouter()
  const { id } = router.query as { id: string }

  const [artist, setArtist] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [econ, setEcon] = useState<any[]>([])
  const [thirds, setThirds] = useState<any[]>([])
  const [photoFile, setPhotoFile] = useState<File|null>(null)

  // Reparto
  const [splits, setSplits] = useState<{member_id:string; name:string; pct:number}[]>([])

  // Contracts nuevos (artista)
  const [newContracts, setNewContracts] = useState<{name:string; signed_at:string; is_active:boolean; file:File}[]>([])

  useEffect(()=> {
    if (!id) return
    ;(async ()=>{
      const { data: a } = await supabase.from('artists').select('*').eq('id', id).single()
      setArtist(a)
      const [{ data: m }, { data: e }, { data: t }, { data: s }] = await Promise.all([
        supabase.from('artist_members').select('*').eq('artist_id', id),
        supabase.from('artist_economics').select('*').eq('artist_id', id),
        supabase.from('third_parties').select('*, third_party_economics(*)').eq('artist_id', id).eq('kind','third'),
        supabase.from('artist_member_splits').select('*').eq('artist_id', id)
      ])
      setMembers(m||[])
      setEcon(e||[])
      setThirds(t||[])
      const map:any = Object.fromEntries((s||[]).map((x:any)=>[x.member_id, x.pct]))
      setSplits((m||[]).map((mm:any)=>({member_id:mm.id, name:mm.full_name, pct:map[mm.id] ?? 0})))
    })()
  }, [id])

  const updateMember = (i:number, k:'full_name'|'dni', v:string) => { const c=[...members]; c[i][k]=v; setMembers(c) }
  const addMember = ()=> setMembers(m=>[...m, {full_name:'', dni:''}])
  const removeMember = (i:number)=> setMembers(m=>m.filter((_:any,idx:number)=>idx!==i))
  const updateEcon = (i:number, k:string, v:any)=>{ const c=[...econ]; c[i][k]=v; setEcon(c) }

  const validateAll = () => {
    if (!artist.stage_name?.trim()) return 'Pon el nombre artístico.'
    if (artist.iban && !validateIBAN(artist.iban)) return 'IBAN no válido.'
    for (const r of econ) {
      if (r.category==='Conciertos a caché') {
        if (!pctOK(r.office_pct)) return 'Caché: % Oficina 0-100.'
        if (r.office_exempt_type==='percent' && !pctOK(r.office_exempt_value)) return 'Caché: Exento (%) 0-100.'
      } else if (r.category==='Royalties Discográficos') {
        if (!pctOK(r.artist_pct)) return 'Royalties: % Artista 0-100.'
      } else {
        if (!pctOK(r.artist_pct)) return `% Artista 0-100.`
        if (!pctOK(r.office_pct)) return `% Oficina 0-100.`
        if (r.office_exempt_type==='percent' && !pctOK(r.office_exempt_value)) return `Exento (%) 0-100.`
      }
    }
    if (artist.is_group) {
      const total = splits.reduce((a,b)=>a + (Number(b.pct)||0), 0)
      if (Math.round(total)!==100) return 'El reparto del grupo debe sumar 100%.'
    }
    return null
  }

  const onSave = async () => {
    const msg = validateAll()
    if (msg) return alert(msg)
    try {
      let photo_url = artist.photo_url
      if (photoFile) photo_url = await uploadAndSign(BUCKET_PHOTOS, photoFile)

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
        iban: artist.iban || null
      }).eq('id', id)
      if (aerr) throw aerr

      // miembros
      await supabase.from('artist_members').delete().eq('artist_id', id)
      for (const m of members) {
        if (m.full_name) await supabase.from('artist_members').insert({ artist_id: id, full_name: m.full_name, dni: m.dni || null })
      }

      // reparto
      if (artist.is_group) {
        await supabase.from('artist_member_splits').delete().eq('artist_id', id)
        for (const s of splits) {
          await supabase.from('artist_member_splits').insert({ artist_id:id, member_id:s.member_id, pct:Number(s.pct)||0 })
        }
      }

      // economía
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
        await supabase.from('artist_economics').insert(payload)
      }

      // contratos nuevos (artista)
      for (const c of newContracts) {
        const url = await uploadAndSign(BUCKET_CONTRACTS, c.file)
        await supabase.from('artist_contracts').insert({
          artist_id: id, name: c.name, signed_at: c.signed_at, is_active: c.is_active, file_url: url
        })
      }

      alert('Guardado.')
      router.push(`/artists/${id}`)
    } catch (e:any) {
      alert(e.message || 'Error guardando')
    }
  }

  if (!artist) return <Layout><div className="module">Cargando…</div></Layout>

  return (
    <Layout>
      <div className="module" style={{background:'#fff'}}>
        <h1>Editar: {artist.stage_name}</h1>
        <div className="row" style={{alignItems:'center'}}>
          <div style={{flex:'1 1 240px'}}>
            <label>Fotografía (reemplazar)</label>
            <input type="file" accept="image/*" onChange={e=>setPhotoFile(e.target.files?.[0] ?? null)}/>
          </div>
        </div>
      </div>

      <div className="module">
        <h2>Datos básicos</h2>
        <div className="row">
          <div style={{flex:'1 1 220px'}}><label>Nombre artístico</label><input value={artist.stage_name||''} onChange={e=>setArtist({...artist, stage_name:e.target.value})}/></div>
          <div style={{flex:'1 1 220px'}}><label>Nombre completo</label><input value={artist.full_name||''} onChange={e=>setArtist({...artist, full_name:e.target.value})}/></div>
          <div style={{flex:'1 1 160px'}}><label>DNI</label><input value={artist.dni||''} onChange={e=>setArtist({...artist, dni:e.target.value})}/></div>
          <div style={{flex:'1 1 160px'}}><label>Nacimiento</label><input type="date" value={artist.birth_date||''} onChange={e=>setArtist({...artist, birth_date:e.target.value})}/></div>
          <div style={{flex:'1 1 160px'}}><label>Tipo contrato</label>
            <select value={artist.contract_type} onChange={e=>setArtist({...artist, contract_type:e.target.value})}>
              <option value="General">General</option>
              <option value="Booking">Booking</option>
            </select>
          </div>
          <div style={{flex:'1 1 160px'}}><label>¿Es grupo?</label>
            <select value={artist.is_group?'sí':'no'} onChange={e=>setArtist({...artist, is_group:e.target.value==='sí'})}>
              <option>no</option><option>sí</option>
            </select>
          </div>
        </div>
      </div>

      <div className="module">
        <h2>Datos fiscales</h2>
        <div className="row">
          <div style={{flex:'1 1 160px'}}><label>Tipo fiscal</label>
            <select value={artist.tax_type} onChange={e=>setArtist({...artist, tax_type:e.target.value})}>
              <option value="particular">Particular</option>
              <option value="empresa">Empresa vinculada</option>
            </select></div>
          <div style={{flex:'1 1 260px'}}><label>Nombre fiscal / Empresa</label>
            <input value={artist.tax_type==='particular' ? (artist.full_name||'') : (artist.tax_name||'')}
                   onChange={e=>setArtist({...artist, tax_name:e.target.value})}
                   disabled={artist.tax_type==='particular'}/></div>
          <div style={{flex:'1 1 200px'}}><label>NIF/CIF</label>
            <input value={artist.tax_type==='particular' ? (artist.dni||'') : (artist.tax_id||'')}
                   onChange={e=>setArtist({...artist, tax_id:e.target.value})}
                   disabled={artist.tax_type==='particular'}/></div>
          <div style={{flex:'1 1 260px'}}><label>IBAN</label><input value={artist.iban||''} onChange={e=>setArtist({...artist, iban:e.target.value})}/></div>
        </div>
      </div>

      {/* Miembros (si es grupo) */}
      {artist.is_group && (
        <div className="module">
          <h2>Miembros del grupo</h2>
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

      {/* Reparto (si es grupo) */}
      {artist.is_group && (
        <div className="module" id="splits">
          <h2>Reparto de beneficio (artista)</h2>
          {splits.map((s,i)=>(
            <div key={s.member_id} className="row" style={{gap:8}}>
              <div style={{flex:'1 1 auto'}}>{s.name}</div>
              <input type="number" value={s.pct} onChange={e=>{
                const c=[...splits]; c[i]={...c[i], pct:Number(e.target.value)}; setSplits(c)
              }}/>
              <span>%</span>
            </div>
          ))}
          <small>La suma debe ser 100%.</small>
        </div>
      )}

      <div className="module">
        <h2>Condiciones económicas</h2>
        {econ.map((r:any, i:number)=>(
          <div key={i} className="row" style={{borderTop:'1px solid #e5e7eb', paddingTop:12, marginTop:12}}>
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

      <div className="module">
        <h2>Añadir contratos (artista)</h2>
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
        <button onClick={onSave}>Guardar</button>
      </div>
    </Layout>
  )
}
