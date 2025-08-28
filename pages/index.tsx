import Nav from '../components/Nav'
export default function Home() {
  return (
    <div className="container">
      <Nav/>
      <h1>Piloto: Alta de artistas</h1>
      <p>Primera etapa: ficha de artista, contrato adjunto, condiciones económicas, terceros y excepciones.</p>
      <div className="card">
        <p>Usa el menú para crear un artista nuevo y probar el flujo.</p>
      </div>
    </div>
  )
}
