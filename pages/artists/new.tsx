// pages/artists/new.tsx
import { useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import Button from '../../components/Button';
import { supabase } from '../../lib/supabaseClient';
import ContractsBlock from '../../components/ContractsBlock';
import ArtistThirdsBlock from '../../components/ArtistThirdsBlock'; // ⬅️ nuevo

export default function NewArtist() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const [stageName, setStageName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [contractType, setContractType] = useState<'General'|'Booking'>('General');

  const [createdId, setCreatedId] = useState<string | null>(null);

  async function create() {
    if (!stageName.trim()) return alert('Pon nombre artístico');
    setCreating(true);
    try {
      const ins = await supabase.from('artists').insert({
        stage_name: stageName,
        is_group: isGroup,
        contract_type: contractType,
        is_archived: false
      }).select('*').single();
      if (ins.error) throw ins.error;
      setCreatedId(ins.data.id);
      alert('Artista creado. Ya puedes añadir terceros y contratos.');
    } catch (e:any) {
      alert(e.message || 'No se pudo crear');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Layout>
      <div className="module" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1 style={{margin:0}}>Nuevo artista</h1>
        <div style={{display:'flex', gap:8}}>
          {!createdId ? <Button onClick={create} disabled={creating}>Guardar</Button> : null}
          {createdId ? <Button as="a" href={`/artists/${createdId}`} tone="neutral">Ir a la ficha</Button> : null}
        </div>
      </div>

      <div className="module">
        <h2>Datos básicos</h2>
        <div className="row">
          <div style={{flex:'1 1 280px'}}><label>Nombre artístico</label>
            <input value={stageName} onChange={e=>setStageName(e.target.value)} />
          </div>
          <div style={{flex:'0 0 220px'}}><label>Tipo de contrato</label>
            <select value={contractType} onChange={e=>setContractType(e.target.value as any)}>
              <option value="General">General</option>
              <option value="Booking">Booking</option>
            </select>
          </div>
          <div style={{flex:'0 0 160px'}}><label>¿Es grupo?</label>
            <select value={isGroup?'sí':'no'} onChange={e=>setIsGroup(e.target.value==='sí')}>
              <option>no</option><option>sí</option>
            </select>
          </div>
        </div>
      </div>

      {/* Una vez creado, aparecen módulos de terceros y contratos */}
      {createdId && (
        <>
          {/* 🔹 Bloque unificado: buscador sin tildes + crear en modal + vinculación automática + lista con Editar/Desvincular */}
          <ArtistThirdsBlock artistId={createdId} />

          {/* 🔹 Contratos (el formulario de alta se despliega al pulsar el botón del propio bloque) */}
          <div className="module">
            <h2>Contratos</h2>
            <ContractsBlock kind="artist" ownerId={createdId} />
          </div>
        </>
      )}
    </Layout>
  );
}
