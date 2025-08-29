// pages/artists/new.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Layout from '../../components/Layout';
import Button from '../../components/Button';

const BUCKET_PHOTOS = 'artist-photos';
const BUCKET_CONTRACTS = 'contracts';

const GENERAL_CATEGORIES = [
  'Conciertos a caché','Conciertos a empresa','Royalties Discográficos',
  'Editorial','Merchandising','Acciones con marcas','Otras acciones'
];

type EconRow = {
  category: string;
  artist_pct: number;
  office_pct: number;
  artist_base: 'gross'|'net';
  office_base: 'gross'|'net';
  office_exempt_type: 'amount'|'percent';
  office_exempt_value: number;
  brands_mode?: 'office_only'|'split';
};

function validateIBAN(iban:string): boolean {
  const s = iban.replace(/\s+/g,'').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{9,30}$/.test(s)) return false;
  const rearr = s.slice(4) + s.slice(0,4);
  const converted = rearr.replace(/[A-Z]/g, ch => (ch.charCodeAt(0)-55).toString());
  let remainder = 0;
  for (let i=0;i<converted.length;i+=7) {
    const part = remainder.toString() + converted.substr(i,7);
    remainder = parseInt(part,10) % 97;
  }
  return remainder === 1;
}
const pctOK = (n:number) => n>=0 && n<=100;

async function uploadAndSign(bucket:string, file:File) {
  const name = `${Date.now()}-${file.name}`;
  const up = await supabase.storage.from(bucket).upload(name, file);
  if (up.error) throw up.error;
  const signed = await supabase.storage.from(bucket).createSignedUrl(name, 60*60*24*365);
  if (signed.error || !signed.data) throw signed.error || new Error('No signed URL');
  return signed.data.signedUrl;
}

export default function NewArtist() {
  // Archivos
  const [photoFile, setPhotoFile] = useState<File|null>(null);
  const [contractFile, setContractFile] = useState<File|null>(null);

  // Básicos
  const [stageName, setStageName] = useState('');
  const [isGroup, setIsGroup] = useState(false);
  const [contractType, setContractType] = useState<'General'|'Booking'>('General');

  // Personales (solista)
  const [fullName, setFullName] = useState('');
  const [dni, setDni] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Fiscales (solista)
  const [taxType, setTaxType] = useState<'particular'|'empresa'>('particular');
  const [taxName, setTaxName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [taxAddress, setTaxAddress] = useState('');
  const [iban, setIban] = useState('');

  // Miembros (grupo): personales + fiscales + reparto
  type Member = {
    full_name: string; dni: string; birth_date: string;
    email: string; phone: string;
    tax_type: 'particular'|'empresa';
    tax_name: string; tax_id: string; tax_address: string; iban: string;
    share_pct: number;
  };
  const emptyMember = ():Member => ({
    full_name:'', dni:'', birth_date:'', email:'', phone:'',
    tax_type:'particular', tax_name:'', tax_id:'', tax_address:'', iban:'',
    share_pct:0
  });
  const [members, setMembers] = useState<Member[]>([]);

  // Econ General
  const makeEmptyGeneral = ():EconRow[] => GENERAL_CATEGORIES.map(c=>({
    category:c, artist_pct:0, office_pct:0, artist_base:'gross', office_base:'gross',
    office_exempt_type:'amount', office_exempt_value:0, brands_mode: c==='Acciones con marcas' ? 'split' : undefined
  }));
  const [econGeneral, setEconGeneral] = useState<EconRow[]>(makeEmptyGeneral());

  // Econ Booking
  const [bookingOfficePct, setBookingOfficePct] = useState(0);
  const [bookingOfficeBase, setBookingOfficeBase] = useState<'gross'|'net'>('gross');
  const [bookingExemptType, setBookingExemptType] = useState<'amount'|'percent'>('amount');
  const [bookingExemptValue, setBookingExemptValue] = useState(0);

  useEffect(()=>{
    if (!isGroup) {
      // si es particular, autocompletar fiscal con personales
      if (taxType==='particular') {
        setTaxName(fullName);
        setTaxId(dni);
      }
    }
  }, [fullName, dni, taxType, isGroup]);

  const addMember = ()=> setMembers(m=>[...m, emptyMember()]);
  const updateMember = (i:number, k:keyof Member, v:any) => {
    const copy=[...members]; (copy[i] as any)[k]=v; setMembers(copy);
  };
  const removeMember = (i:number) => setMembers(m=>m.filter((_,idx)=>idx!==i));

  const handleEconGeneral = (i:number, k:keyof EconRow, v:any)=>{
    const copy=[...econGeneral]; (copy[i] as any)[k]=v; setEconGeneral(copy);
  };

  const validateAll = ()=>{
    if (!stageName.trim()) return 'Pon el nombre artístico.';
    if (!contractFile) return 'Debes adjuntar el contrato (PDF).';
    if (!isGroup) {
      if (iban && !validateIBAN(iban)) return 'IBAN no válido.';
    } else {
      // reparto 100%
      const total = members.reduce((s,m)=> s + Number(m.share_pct||0), 0);
      if (Math.round(total) !== 100) return 'El reparto del grupo debe sumar 100%.';
      for (const m of members) {
        if (m.iban && !validateIBAN(m.iban)) return `IBAN no válido para ${m.full_name || 'miembro'}.`;
      }
    }
    // Econ
    if (contractType==='Booking') {
      if (!pctOK(bookingOfficePct)) return '% Oficina (Booking) debe estar entre 0 y 100.';
      if (bookingExemptType==='percent' && !pctOK(bookingExemptValue)) return 'Exento (%) Booking debe estar entre 0 y 100.';
    } else {
      for (const row of econGeneral) {
        if (row.category==='Conciertos a caché') {
          if (!pctOK(row.office_pct)) return 'En Caché, % Oficina debe estar entre 0 y 100.';
          if (row.office_exempt_type==='percent' && !pctOK(row.office_exempt_value)) return 'Exento (%) en Caché debe estar entre 0 y 100.';
        } else if (row.category==='Royalties Discográficos') {
          if (!pctOK(row.artist_pct)) return 'En Royalties, % Artista debe estar entre 0 y 100.';
        } else {
          if (!pctOK(row.artist_pct)) return `En ${row.category}, % Artista debe estar entre 0 y 100.`;
          if (!pctOK(row.office_pct)) return `En ${row.category}, % Oficina debe estar entre 0 y 100.`;
          if (row.office_exempt_type==='percent' && !pctOK(row.office_exempt_value)) return `En ${row.category}, Exento (%) debe estar entre 0 y 100.`;
        }
      }
    }
    return null;
  };

  const onSubmit = async ()=>{
    const msg = validateAll(); if (msg) return alert(msg);
    try {
      const photo_url = photoFile ? await uploadAndSign(BUCKET_PHOTOS, photoFile) : null;
      const contract_url = await uploadAndSign(BUCKET_CONTRACTS, contractFile!);

      // artista base
      const { data: artist, error: aerr } = await supabase.from('artists').insert({
        stage_name: stageName,
        is_group: isGroup,
        contract_type: contractType,
        photo_url,
        full_name: isGroup ? null : (fullName || null),
        dni: isGroup ? null : (dni || null),
        birth_date: isGroup ? null : (birthDate || null),
        email: isGroup ? null : (email || null),
        phone: isGroup ? null : (phone || null),
        tax_type: isGroup ? null : taxType,
        tax_name: isGroup ? null : (taxType==='particular' ? (fullName || null) : (taxName || null)),
        tax_id: isGroup ? null : (taxType==='particular' ? (dni || null) : (taxId || null)),
        tax_address: isGroup ? null : (taxAddress || null),
        iban: isGroup ? null : (iban || null),
        contract_url
      }).select('*').single();
      if (aerr) throw aerr;

      // miembros (si grupo)
      if (isGroup) {
        for (const m of members) {
          const { error } = await supabase.from('artist_members').insert({
            artist_id: artist.id,
            full_name: m.full_name || null,
            dni: m.dni || null,
            birth_date: m.birth_date || null,
            email: m.email || null,
            phone: m.phone || null,
            tax_type: m.tax_type || null,
            tax_name: m.tax_type==='particular' ? (m.full_name || null) : (m.tax_name || null),
            tax_id: m.tax_type==='particular' ? (m.dni || null) : (m.tax_id || null),
            tax_address: m.tax_address || null,
            iban: m.iban || null,
            share_pct: m.share_pct || 0
          });
          if (error) throw error;
        }
      }

      // Econ
      if (contractType==='Booking') {
        await supabase.from('artist_economics').insert({
          artist_id: artist.id, category:'Booking',
          artist_pct:0, office_pct:bookingOfficePct,
          artist_base:'gross', office_base:bookingOfficeBase,
          office_exempt_type:bookingExemptType, office_exempt_value:bookingExemptValue
        });
      } else {
        for (const e of econGeneral) {
          const row={...e};
          if (row.category==='Conciertos a caché') row.artist_pct = 0;
          if (row.category==='Royalties Discográficos') {
            row.office_pct=0; row.office_base='gross'; row.office_exempt_type='amount'; row.office_exempt_value=0;
          }
          const payload:any = {
            artist_id: artist.id, category: row.category,
            artist_pct: row.artist_pct, office_pct: row.office_pct,
            artist_base: row.artist_base, office_base: row.office_base,
            office_exempt_type: row.office_exempt_type, office_exempt_value: row.office_exempt_value
          };
          if (row.category==='Acciones con marcas') payload.brands_mode = row.brands_mode;
          await supabase.from('artist_economics').insert(payload);
        }
      }

      alert('Artista creado con éxito.');
      window.location.href = '/artists';
    } catch (e:any) {
      alert(e.message || 'Error guardando artista');
    }
  };

  return (
    <Layout>
      <div className="module">
        <h1>Nuevo artista</h1>
      </div>

      <div className="module">
        <h2>Datos básicos</h2>
        <div className="row">
          <div style={{flex:'1 1 220px'}}><label>Fotografía</label>
            <input type="file" accept="image/*" onChange={e=>setPhotoFile(e.target.files?.[0] ?? null)}/>
          </div>
          <div style={{flex:'1 1 220px'}}><label>Nombre artístico</label>
            <input value={stageName} onChange={e=>setStageName(e.target.value)}/>
          </div>
          <div style={{flex:'0 0 160px'}}><label>Tipo contrato</label>
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

      {!isGroup ? (
        <>
          <div className="module">
            <h2>Datos personales</h2>
            <div className="row">
              <div style={{flex:'1 1 260px'}}><label>Nombre completo</label><input value={fullName} onChange={e=>setFullName(e.target.value)}/></div>
              <div style={{flex:'0 0 160px'}}><label>DNI</label><input value={dni} onChange={e=>setDni(e.target.value)}/></div>
              <div style={{flex:'0 0 180px'}}><label>Fecha nacimiento</label><input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></div>
              <div style={{flex:'1 1 260px'}}><label>Email</label><input value={email} onChange={e=>setEmail(e.target.value)}/></div>
              <div style={{flex:'0 0 180px'}}><label>Teléfono</label><input value={phone} onChange={e=>setPhone(e.target.value)}/></div>
            </div>
          </div>

          <div className="module">
            <h2>Datos fiscales</h2>
            <div className="row">
              <div style={{flex:'0 0 180px'}}><label>Tipo fiscal</label>
                <select value={taxType} onChange={e=>setTaxType(e.target.value as any)}>
                  <option value="particular">Particular</option>
                  <option value="empresa">Empresa vinculada</option>
                </select>
              </div>
              <div style={{flex:'1 1 260px'}}><label>Nombre fiscal / Empresa</label>
                <input value={taxName} onChange={e=>setTaxName(e.target.value)} disabled={taxType==='particular'}/>
              </div>
              <div style={{flex:'0 0 200px'}}><label>NIF/CIF</label>
                <input value={taxId} onChange={e=>setTaxId(e.target.value)} disabled={taxType==='particular'}/>
              </div>
              <div style={{flex:'1 1 320px'}}><label>Domicilio fiscal</label>
                <input value={taxAddress} onChange={e=>setTaxAddress(e.target.value)}/>
              </div>
              <div style={{flex:'1 1 280px'}}><label>IBAN</label>
                <input value={iban} onChange={e=>setIban(e.target.value)} placeholder="ES00 0000 0000 0000 0000 0000"/>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="module">
            <h2>Miembros del grupo</h2>
            <Button onClick={addMember}>+ Añadir miembro</Button>
            {members.map((m, i)=>(
              <div key={i} className="card" style={{marginTop:10}}>
                <div className="row">
                  <div style={{flex:'1 1 260px'}}><label>Nombre completo</label><input value={m.full_name} onChange={e=>updateMember(i,'full_name',e.target.value)}/></div>
                  <div style={{flex:'0 0 160px'}}><label>DNI</label><input value={m.dni} onChange={e=>updateMember(i,'dni',e.target.value)}/></div>
                  <div style={{flex:'0 0 180px'}}><label>Nacimiento</label><input type="date" value={m.birth_date} onChange={e=>updateMember(i,'birth_date',e.target.value)}/></div>
                  <div style={{flex:'1 1 260px'}}><label>Email</label><input value={m.email} onChange={e=>updateMember(i,'email',e.target.value)}/></div>
                  <div style={{flex:'0 0 180px'}}><label>Teléfono</label><input value={m.phone} onChange={e=>updateMember(i,'phone',e.target.value)}/></div>
                </div>
                <div className="row" style={{marginTop:6}}>
                  <div style={{flex:'0 0 180px'}}><label>Tipo fiscal</label>
                    <select value={m.tax_type} onChange={e=>updateMember(i,'tax_type', e.target.value as any)}>
                      <option value="particular">Particular</option>
                      <option value="empresa">Empresa</option>
                    </select>
                  </div>
                  <div style={{flex:'1 1 260px'}}><label>Nombre fiscal / Empresa</label>
                    <input value={m.tax_name} onChange={e=>updateMember(i,'tax_name', e.target.value)} disabled={m.tax_type==='particular'}/>
                  </div>
                  <div style={{flex:'0 0 200px'}}><label>NIF/CIF</label>
                    <input value={m.tax_id} onChange={e=>updateMember(i,'tax_id', e.target.value)} disabled={m.tax_type==='particular'}/>
                  </div>
                  <div style={{flex:'1 1 320px'}}><label>Domicilio fiscal</label>
                    <input value={m.tax_address} onChange={e=>updateMember(i,'tax_address', e.target.value)}/>
                  </div>
                  <div style={{flex:'1 1 280px'}}><label>IBAN</label>
                    <input value={m.iban} onChange={e=>updateMember(i,'iban', e.target.value)} placeholder="ES00 …"/>
                  </div>
                </div>
                <div className="row" style={{marginTop:6}}>
                  <div style={{flex:'0 0 160px'}}><label>% Reparto</label>
                    <input type="number" value={m.share_pct} onChange={e=>updateMember(i,'share_pct', Number(e.target.value))}/>
                  </div>
                  <div style={{display:'flex', alignItems:'flex-end'}}><Button tone="danger" onClick={()=>removeMember(i)}>Eliminar</Button></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="module">
        <h2>Contrato (PDF)</h2>
        <input type="file" accept="application/pdf" onChange={e=>setContractFile(e.target.files?.[0] ?? null)}/>
        <small>Obligatorio. Solo PDF.</small>
      </div>

      {contractType==='Booking' ? (
        <div className="module">
          <h2>Condiciones — Booking</h2>
          <div className="row">
            <div style={{flex:'0 0 140px'}}><label>% Oficina</label><input type="number" value={bookingOfficePct} onChange={e=>setBookingOfficePct(Number(e.target.value))}/></div>
            <div style={{flex:'0 0 160px'}}><label>Base</label>
              <select value={bookingOfficeBase} onChange={e=>setBookingOfficeBase(e.target.value as any)}>
                <option value="gross">Bruto</option><option value="net">Neto</option>
              </select>
            </div>
            <div style={{flex:'0 0 220px'}}><label>Exento comisión</label>
              <div className="row" style={{gap:8}}>
                <select style={{flex:'0 0 120px'}} value={bookingExemptType} onChange={e=>setBookingExemptType(e.target.value as any)}>
                  <option value="amount">Importe</option><option value="percent">%</option>
                </select>
                <input style={{flex:'1 1 auto'}} type="number" value={bookingExemptValue} onChange={e=>setBookingExemptValue(Number(e.target.value))}/>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="module">
          <h2>Condiciones — General</h2>
          {econGeneral.map((e, i)=>{
            const isCache = e.category==='Conciertos a caché';
            const isRoy = e.category==='Royalties Discográficos';
            const isBrand = e.category==='Acciones con marcas';
            return (
              <div key={i} className="row" style={{borderTop:'1px solid #e5e7eb', paddingTop:12, marginTop:12}}>
                <div style={{flex:'1 1 220px'}}><div className="badge">{e.category}</div></div>
                {isBrand ? (
                  <div style={{flex:'1 1 220px'}}>
                    <label>Modo</label>
                    <select value={e.brands_mode ?? 'split'} onChange={v=>handleEconGeneral(i,'brands_mode', v.target.value as any)}>
                      <option value="office_only">Comisión de oficina</option>
                      <option value="split">Reparto porcentajes</option>
                    </select>
                  </div>
                ) : null}
                {!isCache && !isRoy && !(isBrand && e.brands_mode==='office_only') ? (
                  <div style={{flex:'0 0 140px'}}><label>% Artista</label>
                    <input type="number" value={e.artist_pct} onChange={v=>handleEconGeneral(i,'artist_pct', Number(v.target.value))}/>
                  </div>
                ) : null}
                {isRoy ? (
                  <>
                    <div style={{flex:'0 0 140px'}}><label>% Artista</label>
                      <input type="number" value={e.artist_pct} onChange={v=>handleEconGeneral(i,'artist_pct', Number(v.target.value))}/>
                    </div>
                    <div style={{flex:'0 0 160px'}}><label>Base Artista</label>
                      <select value={e.artist_base} onChange={v=>handleEconGeneral(i,'artist_base', v.target.value as any)}>
                        <option value="gross">Bruto</option><option value="net">Neto</option>
                      </select>
                    </div>
                  </>
                ) : null}
                {/* Oficina */}
                {!isRoy ? (
                  <>
                    <div style={{flex:'0 0 140px'}}><label>% Oficina</label>
                      <input type="number" value={e.office_pct} onChange={v=>handleEconGeneral(i,'office_pct', Number(v.target.value))}/>
                    </div>
                    <div style={{flex:'0 0 160px'}}><label>Base Oficina</label>
                      <select value={e.office_base} onChange={v=>handleEconGeneral(i,'office_base', v.target.value as any)}>
                        <option value="gross">Bruto</option><option value="net">Neto</option>
                      </select>
                    </div>
                    <div style={{flex:'1 1 260px'}}><label>Exento (Oficina)</label>
                      <div className="row" style={{gap:8}}>
                        <select style={{flex:'0 0 120px'}} value={e.office_exempt_type} onChange={v=>handleEconGeneral(i,'office_exempt_type', v.target.value as any)}>
                          <option value="amount">Importe</option><option value="percent">%</option>
                        </select>
                        <input style={{flex:'1 1 auto'}} type="number" value={e.office_exempt_value} onChange={v=>handleEconGeneral(i,'office_exempt_value', Number(v.target.value))}/>
                      </div>
                    </div>
                  </>
                ) : null}
                {!isCache && !isRoy && !(isBrand && e.brands_mode==='office_only') ? (
                  <div style={{flex:'0 0 160px'}}><label>Base Artista</label>
                    <select value={e.artist_base} onChange={v=>handleEconGeneral(i,'artist_base', v.target.value as any)}>
                      <option value="gross">Bruto</option><option value="net">Neto</option>
                    </select>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="module">
        <Button onClick={onSubmit}>Guardar artista</Button>
      </div>
    </Layout>
  );
}
