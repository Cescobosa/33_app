// pages/artists/[id]/edit.tsx
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import Layout from '../../../components/Layout'

const BUCKET_PHOTOS = 'artist-photos'
const BUCKET_CONTRACTS = 'contracts'

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
  const [photoFile, setPhotoFile] = useState<File|null>(null)
  const [contractFile, setContractFile] = useState<File|null>(null)

  const [econ, setEcon] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
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

  const updateMember = (i:number, k:'full_name'|'dni', v:string) => { const c=[...members]; c[i][k]=v; setMembers(c) }
  const addMember = ()=> setMembers(m=>[...m, {full_name:'', dni:''}])
  const removeMember = (i:number)=> setMembers(m=>m.filter((_:any,idx:number)=>idx!==i))

  const updateEcon = (i:number, k:string, v:any) => { const c=[...econ]; c[i][k]=v; setEcon(c) }

  const addThird = ()=> setThirds(t=>[...t, {
    nick:'', name:'', tax_id:'', email:'', phone:'',
    logo_url:null, contract_url:null, is_active:true,
    econ:[]
  }])
  const updateThirdField = (ti:number, k:string, v:any)=>{ const c=[...thirds]; c[ti][k]=v; setThirds(c) }
  const updateThirdEcon = (ti:number, ci:number, k:string, v:any)=>{ const c=[...thirds]; c[ti].econ[ci][k]=v; setThirds(c) }
  const removeThird = (ti:number)=> setThirds(ts=>ts.filter((_:any,idx:number)=>idx!==ti))

  const validateAll = () => {
    if (!artist.stage_name?.trim()) return 'Pon el nombre artístico.'
    if (artist.iban && !validateIBAN(artist.iban)) return 'IBAN no válido. Introduce el IBAN completo.'
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
      let photo_url = artist.photo_url
      let contract_url = artist.contract_url
      if (photoFile) photo_url = await uploadAndSign(BUCKET_PHOTOS, photoFile)
      if (contractFile) contract_url = await uploadAndSign(BUCKET_CONTRACTS, contractFile)

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

      await supabase.from('artist_members').delete().eq('artist_id', id)
      for (const m of members) {
        if (m.full_name) {
          const { error } = await supabase.from('artist_members').insert({ artist_id: id, full_name: m.full_name, dni: m.dni || null })
          if (error) throw error
        }
      }

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
          is_active: t.is_active !== false,
          kind: 'third'
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

  if (!artist) return <Layout><div className="module">Cargando…</div></Layout>

  return (
    <Layout>
      {/* … (contenido igual al que pegaste) … */}
      <div className="module">
        <button onClick={onSave}>Guardar cambios</button>
      </div>
    </Layout>
  )
}
