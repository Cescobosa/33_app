import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../../lib/supabaseClient'
import Layout from '../../../../components/Layout'

const BUCKET_LOGOS = 'artist-photos'   // reutilizamos bucket de imágenes
const BUCKET_CONTRACTS = 'contracts'

async function uploadAndSign(bucket: string, file: File) {
  const name = `${Date.now()}-${file.name}`
  const { error: upErr } = await supabase.storage.from(bucket).upload(name, file)
  if (upErr) throw upErr
  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(name, 60 * 60 * 24 * 365)
  if (signErr || !data) throw signErr || new Error('No signed URL')
  return data.signedUrl
}

export default function EditProvider() {
  const router = useRouter()
  const { id } = router.query as { id: string }

  const [row, setRow] = useState<any>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [contractFile, setContractFile] = useState<File | null>(null)

  useEffect(() => {
    if (!id) return
    ;(async () => {
      const { data, error } = await supabase
        .from('third_parties')
        .select('*')
        .eq('id', id)
        .eq('kind', 'provider')
        .single()
      if (error) {
        alert(error.message)
        return
      }
      setRow(data)
    })()
  }, [id])

  const onSave = async () => {
    try {
      let logo_url = row?.logo_url || null
      let contract_url = row?.contract_url || null

      if (logoFile) logo_url = await uploadAndSign(BUCKET_LOGOS, logoFile)
      if (contractFile) contract_url = await uploadAndSign(BUCKET_CONTRACTS, contractFile)

      const { error } = await supabase
        .from('third_parties')
        .update({
          nick: row.nick || null,
          name: row.name || null,
          tax_id: row.tax_id || null,
          email: row.email || null,
          phone: row.phone || null,
          logo_url,
          contract_url,
          is_active: row.is_active !== false,
          kind: 'provider',
        })
        .eq('id', id)

      if (error) throw error

      alert('Proveedor guardado.')
      router.push(`/partners/providers/${id}`)
    } catch (e: any) {
      alert(e.message || 'Error guardando')
    }
  }

  if (!row) return <Layout><div className="module">Cargando…</div></Layout>

  return (
    <Layout>
      <div className="module" style={{ background: '#fff' }}>
        <h1>Editar proveedor</h1>
        <div className="row">
          <div style={{ flex: '1 1 240px' }}>
            <label>Logo / Foto (reemplazar)</label>
            <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
          </div>
          <div style={{ flex: '1 1 280px' }}>
            <label>Contrato (PDF/imagen) — reemplazar</label>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setContractFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
      </div>

      <div className="module">
        <h2>Datos del proveedor</h2>
        <div className="row">
          <div style={{ flex: '1 1 200px' }}>
            <label>Nick</label>
            <input value={row.nick || ''} onChange={(e) => setRow({ ...row, nick: e.target.value })} />
          </div>
          <div style={{ flex: '1 1 300px' }}>
            <label>Nombre fiscal / Compañía</label>
            <input value={row.name || ''} onChange={(e) => setRow({ ...row, name: e.target.value })} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label>NIF/CIF</label>
            <input value={row.tax_id || ''} onChange={(e) => setRow({ ...row, tax_id: e.target.value })} />
          </div>
          <div style={{ flex: '1 1 240px' }}>
            <label>Email</label>
            <input value={row.email || ''} onChange={(e) => setRow({ ...row, email: e.target.value })} />
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label>Teléfono</label>
            <input value={row.phone || ''} onChange={(e) => setRow({ ...row, phone: e.target.value })} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label>Activo</label>
            <select
              value={row.is_active ? 'sí' : 'no'}
              onChange={(e) => setRow({ ...row, is_active: e.target.value === 'sí' })}
            >
              <option>sí</option>
              <option>no</option>
            </select>
          </div>
        </div>
      </div>

      <div className="module">
        <button onClick={onSave}>Guardar</button>
      </div>
    </Layout>
  )
}
