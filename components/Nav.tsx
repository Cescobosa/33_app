import Link from 'next/link'

export default function Nav() {
  return (
    <nav className="container" style={{display:'flex', gap:16, alignItems:'center'}}>
      <Link href="/">Inicio</Link>
      <Link href="/artists">Artistas</Link>
      <Link href="/artists/new">Nuevo artista</Link>
    </nav>
  )
}
