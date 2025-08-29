import { useEffect } from 'react'
import Layout from '../../../components/Layout'

export default function ThirdsNewBlocked() {
  useEffect(() => {
    // solo mostramos mensaje; si prefieres redirigir:
    // window.location.href = '/partners/providers/new'
  }, [])
  return (
    <Layout>
      <div className="module">
        <h1>Alta de terceros</h1>
        <p>Los <b>terceros</b> solo se pueden crear desde la <b>ficha del artista</b> (módulo “Terceros vinculados”).</p>
        <p>Desde esta sección solo puedes crear <b>Proveedores</b>.</p>
        <div style={{marginTop:12}}>
          <a href="/partners/providers/new" className="btn">+ Crear proveedor</a>
        </div>
      </div>
    </Layout>
  )
}
