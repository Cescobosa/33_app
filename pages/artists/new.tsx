import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Layout from '../../components/Layout';
import Button from '../../components/Button';

const BUCKET_PHOTOS = 'artist-photos';
const BUCKET_CONTRACTS = 'contracts';

async function uploadAndSign(bucket:string, file: File) {
  const safe = file.name.normalize('NFC');
  const name = `${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage.from(bucket).upload(name, file);
  if (upErr) throw upErr;
  const { data, error: signErr } = await supabase
    .storage.from(bucket)
    .createSignedUrl(name, 60 * 60 * 24 * 365);
  if (signErr || !data) throw signErr || new Error('No signed URL');
  return data.signedUrl;
}

export default function NewArtist() {
  // básicos
  const [photoFile, setPhotoFile] = useState<File|null>(null);
  const [stageName, setStageName] = useState('');
  const [contractType, setContractType] = useState<'General'|'Booking'>('General');
  const [isGroup, setIsGroup] = useState(false);

  // personales (solista)
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // fiscales (solista)
  const [taxType, setTaxType] = useState<'particular'|'empresa'>('particular');
  const [taxName, setTaxName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [taxAddress, setTaxAddress] = useState('');
  const [iban, setIban] = useState('');

  // contrato (igual a ContractsBlock)
  const [cName, setCName] = useState('');
  const [cDate, setCDate] = useState('');
  const [cActive, setCActive] = useState(true);
  const [cFile, setCFile] = useState<File|null>(null);

  function validate() {
    if (!stageName.trim()) return 'Pon el nombre artístico.';
    if (!cFile || !cName.trim()) return 'Añade el contrato (nombre + PDF).';
    return null;
  }

  async function onSave() {
    const msg = validate();
    if (msg) return alert(msg);
    try {
      const photo_url = photoFile ? await uploadAndSign(BUCKET_PHOTOS, photoFile) : null;
      const { data: artist, error } = await supabase
        .from('artists')
        .insert({
          stage_name: stageName,
          contract_type: contractType,
          is_group: isGroup,
          photo_url,
          // personales (solista; si es grupo, luego se podrán añadir miembros en edición)
          full_name: isGroup ? null : (fullName || null),
          dni: isGroup ? null : (dni || null),
          birth_date: isGroup ? null : (birthDate || null),
          email: isGroup ? null : (email || null),
          phone: isGroup ? null : (phone || null),
          // fiscales solista
          tax_type: isGroup ? null : taxType,
          tax_name: isGroup ? null : (taxType==='empresa' ? (taxName || null) : (fullName || null)),
          tax_id: isGroup ? null : (taxType==='empresa' ? (taxId || null) : (dni || null)),
          tax_address: isGroup ? null : (taxAddress || null),
          iban: isGroup ? null : (iban || null),
        })
        .select('*')
        .single();
      if (error) throw error;

      // contrato
      const file_url = await uploadAndSign(BUCKET_CONTRACTS, cFile!);
      const { error: e2 } = await supabase.from('artist_contracts').insert({
        artist_id: artist.id,
        name: cName,
        signed_at: cDate || null,
        active: cActive,
        file_url
      });
      if (e2) throw e2;

      alert('Artista creado.');
      window.location.href = `/artists/${artist.id}`;
    } catch (e:any) {
      alert(e.message || 'Error creando artista');
    }
  }

  return (
    <Layout>
      <h1>Nuevo artista</h1>

      {/* Datos básicos */}
      <div className="module">
        <h2>Datos básicos</h2>
        <div className="row">
          <div style={{ flex:'1 1 240px' }}>
            <label>Fotografía</label>
            <input type="file" accept="image/*" onChange={e=>setPhotoFile(e.target.files?.[0] || null)}/>
          </div>
          <div style={{ flex:'1 1 260px' }}>
            <label>Nombre artístico</label>
            <input value={stageName} onChange={e=>setStageName(e.target.value)} />
          </div>
          <div style={{ flex:'0 0 180px' }}>
            <label>Tipo de contrato</label>
            <select value={contractType} onChange={e=>setContractType(e.target.value as any)}>
              <option value="General">General</option>
              <option value="Booking">Booking</option>
            </select>
          </div>
          <div style={{ flex:'0 0 160px' }}>
            <label>¿Es grupo?</label>
            <select value={isGroup?'sí':'no'} onChange={e=>setIsGroup(e.target.value==='sí')}>
              <option>no</option>
              <option>sí</option>
            </select>
          </div>
        </div>
      </div>

      {/* Datos personales (solo solista) */}
      {!isGroup && (
        <div className="module">
          <h2>Datos personales</h2>
          <div className="row">
            <div style={{ flex:'1 1 260px' }}><label>Nombre completo</label><input value={fullName} onChange={e=>setFullName(e.target.value)}/></div>
            <div style={{ flex:'0 0 160px' }}><label>DNI</label><input value={dni} onChange={e=>setDni(e.target.value)}/></div>
            <div style={{ flex:'0 0 180px' }}><label>Nacimiento</label><input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></div>
            <div style={{ flex:'1 1 260px' }}><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)}/></div>
            <div style={{ flex:'0 0 180px' }}><label>Teléfono</label><input value={phone} onChange={e=>setPhone(e.target.value)}/></div>
          </div>
        </div>
      )}

      {/* Datos fiscales (solo solista en alta; para grupo se rellenan por miembro en edición) */}
      {!isGroup && (
        <div className="module">
          <h2>Datos fiscales</h2>
          <div className="row">
            <div style={{ flex:'0 0 160px' }}><label>Tipo</label>
              <select value={taxType} onChange={e=>setTaxType(e.target.value as any)}>
                <option value="particular">Particular</option>
                <option value="empresa">Empresa</option>
              </select>
            </div>
            <div style={{ flex:'1 1 260px' }}><label>Nombre fiscal / Empresa</label>
              <input value={taxType==='empresa'?taxName:fullName} onChange={e=>setTaxName(e.target.value)} disabled={taxType!=='empresa'} />
            </div>
            <div style={{ flex:'0 0 200px' }}><label>NIF/CIF</label>
              <input value={taxType==='empresa'?taxId:dni} onChange={e=>setTaxId(e.target.value)} disabled={taxType!=='empresa'} />
            </div>
            <div style={{ flex:'1 1 320px' }}><label>Domicilio fiscal</label>
              <input value={taxAddress} onChange={e=>setTaxAddress(e.target.value)} />
            </div>
            <div style={{ flex:'1 1 280px' }}><label>IBAN</label>
              <input value={iban} onChange={e=>setIban(e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000"/>
            </div>
          </div>
        </div>
      )}

      {/* Contrato (igual que en las fichas) */}
      <div className="module">
        <h2>Contrato</h2>
        <div className="row" style={{ gap: 12 }}>
          <div style={{ flex:'1 1 240px' }}><label>Nombre del contrato</label><input value={cName} onChange={e=>setCName(e.target.value)} /></div>
          <div style={{ flex:'0 0 180px' }}><label>Fecha firma</label><input type="date" value={cDate} onChange={e=>setCDate(e.target.value)} /></div>
          <div style={{ flex:'0 0 140px' }}><label>En vigor</label>
            <select value={cActive?'sí':'no'} onChange={e=>setCActive(e.target.value==='sí')}>
              <option>sí</option><option>no</option>
            </select>
          </div>
          <div style={{ flex:'1 1 260px' }}><label>Archivo (PDF)</label>
            <input type="file" accept=".pdf" onChange={e=>setCFile(e.target.files?.[0]||null)} />
          </div>
        </div>
      </div>

      <div className="module">
        <Button onClick={onSave}>Guardar artista</Button>
      </div>
    </Layout>
  );
}
