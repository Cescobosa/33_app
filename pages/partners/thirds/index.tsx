import { useEffect, useState } from 'react'
import Layout from '../../../components/Layout'
import { supabase } from '../../../lib/supabaseClient'

type Row = { id:string; nick:string|null; name:string|null; logo_url:string|null }

export default function ThirdsIndex() {
  const [q,setQ]=useState(''); const [rows,setRows]=useState<Row[]>([])
  useEffect(()=>{ load() },[])
  async function load() {
    const { data } = await supabase
      .from('third_parties')
      .select('id,nick,name,logo_url')
      .eq('kind','third')
      .order('nick', { ascending:true })
      .limit(200)
    setRows(data||[])
  }
  const filtered = rows.filter(r=>{
    const t=(q||'').toLowerCase()
    const label = (r.nick||r.name||'').toLowerCase()
    return label.includes(t)
  })
  return (
    <Layout>
      <h1>Terceros</h1>
      <div className="module">
        <div className="row">
          <div style={{flex:'1 1 300px'}}>
            <input placeholder="Buscar por nick o nombre…" value={q} onChange={e=>setQ(e.target.value)}/>
          </div>
          <div><a className="btn" href="/partners/providers/new">+ Crear proveedor</a></div>
        </div>
      </div>
      <div className="module">
        {filtered.map(r=>{
          const label = r.nick||r.name||'(sin nombre)'
          return (
            <a key={r.id} href={`/partners/thirds/${r.id}`} className="row" style={{alignItems:'center',gap:12,padding:'8px 0', borderBottom:'1px solid #f3f4f6'}}>
              <div style={{width:40,height:40,borderRadius:8,overflow:'hidden',background:'#f3f4f6'}}>
                {r.logo_url ? <img src={r.logo_url} alt={label} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : null}
              </div>
              <div style={{fontWeight:700}}>{label}</div>
            </a>
          )
        })}
      </div>
    </Layout>
  )
}
