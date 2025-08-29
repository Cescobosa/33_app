import Link from 'next/link'
import { useRouter } from 'next/router'

function Item({href, icon, label}:{href:string; icon:string; label:string}) {
  const { pathname } = useRouter()
  const active = pathname.startsWith(href)
  return (
    <Link href={href} className={`item ${active?'active':''}`}>
      <span className="icon">{icon}</span>
      <span>{label}</span>
    </Link>
  )
}
export default function Sidebar(){
  return (
    <aside className="sidebar">
      <div style={{fontWeight:800, marginBottom:8}}>33 · Backoffice</div>
      <Item href="/artists" icon="🎤" label="Artistas"/>
      <Item href="/partners" icon="🤝" label="Proveedores / Terceros"/>
      {/* aquí iremos añadiendo más secciones */}
    </aside>
  )
}
