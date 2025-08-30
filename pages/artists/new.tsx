// pages/artists/new.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Layout from '../../components/Layout';
import Button from '../../components/Button';
import PartySearchSelect from '../../components/PartySearchSelect';

const BUCKET_PHOTOS = 'artist-photos';
const BUCKET_CONTRACTS = 'contracts';

type DraftContract = { name:string; signed_at:string; is_active:boolean; file:File };

async function uploadAndSign(bucket:string, file:File) {
  const key = `${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(key, file);
  if (upErr) throw upErr;
  const { data, error: signErr } = await supabase.storage.from(bucket).createSignedUrl(key, 60*60*24*365);
  if (signErr || !data) throw signErr || new Error('No signed URL');
  return data.signedUrl;
}

export default function NewArtist() {
  const [photo, setPhoto] = useState<File|null>(null);
  const [stageName, setStageName] = useState('');
  const [contractType, setContractType] = useState<'General'|'Booking'>('General');
  const [isGroup, setIsGroup] = useState(false);

  // fiscales/personales mínimos para el alta
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');

  // contratos “borrador”
  const [draftContracts, setDraftContracts] = useState<DraftContract[]>([]);
  const [cName, setCName] = useState(''); const [cDate, setCDate] = useState(''); const [cActive, setCActive] = useState<'sí'|'no'>('sí'); const [cFile, setCFile] = useState<File|null>(null);

  // terceros a vincular tras crear el artista
  const [preThirds, setPreThirds] = useState<{id:string; nick?:string|null; name?:string|null}[]>([]);

  function addDraftContract() {
    if (!cFile) return alert('Selecciona PDF');
    setDraftContracts(a=>[...a, { name:cName||'', signed_at:cDate||'', is_active:(cActive==='sí'), file:cFile }]);
    setCName(''); setCDate(''); setCActive('sí'); setCFile(null);
  }
  function removeDraftContract(i:number) {
    setDraftContracts(a=>a.filter((_,idx)=>idx!==i));
  }

  async function onSubmit() {
    if (!stageName.trim()) return alert('Pon el nombre artístico');
    try {
      let photo_url:string|null = null;
      if (photo) photo_url = await uploadAndSign(BUCKET_PHOTOS, photo);

      const { data: artist, error } = await supabase
        .from('artists')
        .insert({
          stage_name: stageName,
          contract_type: contractType,
          is_group: isGroup,
          full_name: fullName || null,
          dni: dni || null,
          photo_url
        })
        .select('*').single();
      if (error) throw error;

      // contratos
      for (const dc of draftContracts) {
        const file_url = await uploadAndSign(BUCKET_CONTRACTS, dc.file);
        await supabase.from('artist_contracts').insert({
          artist_id: artist.id,
          name: dc.name || null,
          signed_at: dc.signed_at || null,
          is_active: dc.is_active,
          file_url
        });
      }

      // vincular terceros seleccionados
      for (const tp of preThirds) {
        await supabase.from('third_parties').update({ artist_id: artist.id, unlinked:false, unlinked_at:null, unlinked_from_artist_id:null }).eq('id', tp.id);
      }

      alert('Artista creado');
      window.location.href = `/artists/${artist.id}`;
    } catch (e:any) {
      alert(e.message || 'Error creando artista');
    }
  }

  return (
    <Layout>
      <div className="module">
        <h1>Nuevo artista</h1>
      </div>

      <div className="module">
        <h2>Datos básicos</h2>
        <div className="row" style={{gap:8}}>
          <div><label>Fotografía</label><input type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0] || null)}/></div>
          <div style={{flex:'1 1 220px'}}><label>Nombre artístico</label><input value={stageName} onChange={e=>setStageName(e.target.value)}/></div>
          <div style={{flex:'0 0 160px'}}><label>Tipo contrato</label>
            <select value={contractType} onChange={e=>setContractType(e.target.value as any)}>
              <option value="General">General</option>
              <option value="Booking">Booking</option>
            </select>
          </div>
          <div style={{flex:'0 0 160px'}}><label>¿Grupo?</label>
            <select value={isGroup?'sí':'no'} onChange={e=>setIsGroup(e.target.value==='sí')}>
              <option>no</option><option>sí</option>
            </select>
          </div>
        </div>
      </div>

      <div className="module">
        <h2>Datos personales mínimos</h2>
        <div className="row" style={{gap:8}}>
          <div style={{flex:'1'}}><label>Nombre completo</label><input value={fullName} onChange={e=>setFullName(e.target.value)}/></div>
          <div style={{flex:'0 0 200px'}}><label>DNI</label><input value={dni} onChange={e=>setDni(e.target.value)}/></div>
        </div>
      </div>

      <div className="module">
        <h2>Contratos</h2>
        {draftContracts.length===0 ? <small>No hay contratos.</small> : null}
        {draftContracts.map((dc,i)=>(
          <div key={i} className="row" style={{borderTop:'1px dashed #e5e7eb', paddingTop:8, marginTop:8}}>
            <div style={{flex:'1'}}><strong>{dc.name||'Sin nombre'}</strong></div>
            <div style={{flex:'0 0 160px'}}>{dc.signed_at||'—'}</div>
            <div style={{flex:'0 0 120px'}}>{dc.is_active ? <span className="badge" style={{background:'#16a34a22', color:'#166534'}}>En vigor</span> : <span className="badge">No activo</span>}</div>
            <div><Button tone="danger" onClick={()=>removeDraftContract(i)}>Eliminar</Button></div>
          </div>
        ))}
        <div className="card" style={{marginTop:12}}>
          <h4 style={{marginTop:0}}>Añadir contrato</h4>
          <div className="row" style={{gap:8}}>
            <input placeholder="Nombre contrato" value={cName} onChange={e=>setCName(e.target.value)}/>
            <input type="date" value={cDate} onChange={e=>setCDate(e.target.value)}/>
            <select value={cActive} onChange={e=>setCActive(e.target.value as any)}><option>sí</option><option>no</option></select>
          </div>
          <div className="row" style={{gap:8, marginTop:8}}>
            <input type="file" accept="application/pdf" onChange={e=>setCFile(e.target.files?.[0] || null)}/>
            <Button onClick={addDraftContract}>Guardar contrato</Button>
          </div>
        </div>
      </div>

      <div className="module">
        <h2>Terceros vinculados</h2>
        <PartySearchSelect
          mode="third"
          onPicked={(tp)=> setPreThirds(arr => arr.find(a=>a.id===tp.id) ? arr : [...arr, {id:tp.id, nick:tp.nick, name:tp.name}])}
        />
        {preThirds.length===0 ? <small>No hay terceros seleccionados.</small> : (
          <div className="cards-list" style={{marginTop:8}}>
            {preThirds.map(t=>(
              <div key={t.id} className="row card" style={{alignItems:'center', justifyContent:'space-between'}}>
                <div style={{fontWeight:600}}>{t.nick || t.name || t.id}</div>
                <Button tone="danger" onClick={()=>setPreThirds(arr=>arr.filter(a=>a.id!==t.id))}>Quitar</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="module">
        <Button onClick={onSubmit}>Crear artista</Button>
      </div>
    </Layout>
  );
}
