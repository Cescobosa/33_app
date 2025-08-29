import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import Layout from '../../components/Layout'

type Row = { id:string; kind:'third'|'provider'; nick:string|null; name:string|null; logo_url:string|null; tax_name:string|null; is_active:boolean }

export default function Partners(){
  const [tab, setTab] = useState<'thirds'|'providers'>('thirds')
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState<Row[]>([])

  const load = async () => {
    const { data, error } = await supabase
      .from('third_parties')
      .select('id, kind, nick, name, logo_url, tax_name, is_active')
      .eq('kind', tab==='thirds' ? 'third':'provider')
      .eq('is_active', true)
      .order('name')
    if (error) alert(error.message); else setRows(data as any || [])
  }
  useEffect(()=>{ load() }, [tab])

  useEffect(()=>{
    if (!q.trim()) { setSuggestions([]); return }
    const lower = q.toLowerCase()
    const filtered = rows.filter(r =>
      (r.nick||'').toLowerCase().includes(lower) ||
      (r.name||'').toLowerCase().includes(lower) ||
      (r.tax_name||'').toLowerCase().includes(lower)
    ).slice(0,10)
    setSuggestions(filtered)
  }, [q, rows])

  return (
    <Layout>
      <div className="topbar">
        <h1>Proveedores / Terceros</h1>
        <div className="badge" style={{background:'#fff'}}>Activos</div>
      </div>

      <div className="row" style={{gap:8, marginBottom:8}}>
        <button onClick={()=>setTab('thirds')} style={{background: tab==='thirds'?'#d42842':'#eef2f7', color: tab==='thirds'?'#fff':'#111'}}>Terceros</button>
        <button onClick={()=>setTab('providers')} style={{background: tab==='providers'?'#d42842':'#eef2f7', color: tab==='providers'?'#fff':'#111'}}>Proveedores</button>
        <Link href="/partners/new" className="badge" style={{marginLeft:'auto'}}>+ Añadir</Link>
      </div>

      <div className="searchbox" style={{maxWidth:420, marginBottom:12}}>
        <span className="icon">🔎</span>
        <input placeholder="Buscar por nick, nombre fiscal..." value={q} onChange={e=>setQ(e.target.value)} />
        {suggestions.length>0 && (
          <div className="suggestions">
            {suggestions.map(s=>(
              <Link key={s.id}
                className="suggestion"
                href={tab==='thirds' ? `/partners/thirds/${s.id}` : `/partners/providers/${s.id}`}>
                {s.logo_url ? <img src={s.logo_url}/> : <div className="badge">—</div>}
                <div>
                  <div style={{fontWeight:700}}>{s.nick || s.name}</div>
                  <small>{s.tax_name || s.name}</small>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid">
        {rows.map(r=>(
          <Link key={r.id}
            className="card"
            href={tab==='thirds' ? `/partners/thirds/${r.id}` : `/partners/providers/${r.id}`}>
            {r.logo_url ? <img className="thumb" src={r.logo_url}/> : null}
            <div style={{fontWeight:800}}>{r.nick || r.name}</div>
            <small>{r.tax_name || r.name}</small>
          </Link>
        ))}
      </div>
    </Layout>
  )
}
