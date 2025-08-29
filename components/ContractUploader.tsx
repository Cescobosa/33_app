import { useState } from 'react'

type Props = {
  onAdd: (row: { name: string; signed_at: string; is_active: boolean; file: File }) => void
}

export default function ContractUploader({ onAdd }: Props) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [active, setActive] = useState(true)
  const [file, setFile] = useState<File|null>(null)

  const submit = () => {
    if (!name.trim()) return alert('Pon el nombre del contrato.')
    if (!date) return alert('Pon la fecha de firma.')
    if (!file) return alert('Adjunta el PDF.')
    if (file.type !== 'application/pdf') return alert('Solo se admiten PDF.')
    onAdd({ name, signed_at: date, is_active: active, file })
    setName(''); setDate(''); setActive(true); setFile(null)
  }

  return (
    <div className="row" style={{gap:12}}>
      <input placeholder="Nombre del contrato" value={name} onChange={e=>setName(e.target.value)} />
      <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
      <select value={active ? 'sí':'no'} onChange={e=>setActive(e.target.value==='sí')}>
        <option>sí</option><option>no</option>
      </select>
      <input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0] ?? null)} />
      <button onClick={submit}>Añadir contrato</button>
    </div>
  )
}
