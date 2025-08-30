// components/ContractsBlock.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';

const BUCKET = 'contracts';

type Base = { id: string; name: string|null; signed_at: string|null; file_url: string|null; is_active: boolean|null; created_at?: string };
type Props = {
  kind: 'artist'|'third';
  ownerId: string;                 // artist_id ó third_party_id
};

async function uploadAndSign(file: File) {
  const key = `${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file);
  if (upErr) throw upErr;
  const { data, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(key, 60*60*24*365);
  if (signErr || !data) throw signErr || new Error('No signed URL');
  return data.signedUrl;
}

export default function ContractsBlock({ kind, ownerId }: Props) {
  const [rows, setRows]   = useState<Base[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);

  // nuevo
  const [nName, setNName] = useState('');
  const [nDate, setNDate] = useState('');
  const [nActive, setNActive] = useState('sí');
  const [nFile, setNFile] = useState<File|null>(null);

  // edición inline
  const [editId, setEditId] = useState<string|null>(null);
  const [eName, setEName] = useState('');
  const [eDate, setEDate] = useState('');
  const [eActive, setEActive] = useState('sí');
  const [eFile, setEFile] = useState<File|null>(null);

  const table = kind==='artist' ? 'artist_contracts' : 'third_party_contracts';
  const fk    = kind==='artist' ? 'artist_id'        : 'third_party_id';

  async function load() {
    setLoading(true); setErr(null);
    const { data, error } = await supabase
      .from(table)
      .select('id, name, signed_at, is_active, file_url, created_at')
      .eq(fk, ownerId)
      .order('created_at', { ascending: false });
    if (error) setErr(error.message);
    setRows(data || []);
    setLoading(false);
  }
  useEffect(()=>{ if (ownerId) load(); }, [ownerId]);

  async function onCreate() {
    if (!nFile) return alert('Selecciona el PDF');
    const file_url = await uploadAndSign(nFile);
    const payload:any = {
      [fk]: ownerId,
      name: nName || null,
      signed_at: nDate || null,
      is_active: (nActive==='sí'),
      file_url
    };
    const { error } = await supabase.from(table).insert(payload);
    if (error) return alert(error.message);
    setNName(''); setNDate(''); setNActive('sí'); setNFile(null);
    await load();
  }

  function beginEdit(r:Base) {
    setEditId(r.id);
    setEName(r.name || '');
    setEDate(r.signed_at || '');
    setEActive(r.is_active ? 'sí' : 'no');
    setEFile(null);
  }
  async function onSaveEdit() {
    if (!editId) return;
    let file_url: string | undefined = undefined;
    if (eFile) file_url = await uploadAndSign(eFile);
    const { error } = await supabase.from(table).update({
      name: eName || null,
      signed_at: eDate || null,
      is_active: (eActive==='sí'),
      ...(file_url ? { file_url } : {})
    }).eq('id', editId);
    if (error) return alert(error.message);
    setEditId(null); setEFile(null);
    await load();
  }
  async function onDelete(id:string) {
    const confirm = prompt('Para eliminar, escribe: ELIMINAR');
    if (confirm !== 'ELIMINAR') return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return alert(error.message);
    await load();
  }

  return (
    <div className="card">
      <h3 style={{marginTop:0}}>Contratos</h3>

      {/* listado */}
      {loading ? <div>Cargando…</div> : null}
      {err ? <div style={{color:'#d42842'}}>Error: {err}</div> : null}
      {(!loading && rows.length===0) ? <small>No hay contratos.</small> : null}

      {rows.map(r=>(
        <div key={r.id} className="row" style={{borderTop:'1px dashed #e5e7eb', paddingTop:8, marginTop:8}}>
          <div style={{flex:'1 1 40%'}}>
            {editId===r.id ? (
              <input value={eName} onChange={e=>setEName(e.target.value)} placeholder="Nombre contrato"/>
            ) : (
              <strong>{r.name || 'Sin nombre'}</strong>
            )}
            <div>
              {r.file_url ? <a href={r.file_url} target="_blank" rel="noreferrer">Descargar PDF</a> : <small>Sin archivo</small>}
            </div>
          </div>
          <div style={{flex:'0 0 200px'}}>
            {editId===r.id ? (
              <input type="date" value={eDate} onChange={e=>setEDate(e.target.value)}/>
            ) : (
              <div>{r.signed_at || '—'}</div>
            )}
          </div>
          <div style={{flex:'0 0 160px'}}>
            {editId===r.id ? (
              <select value={eActive} onChange={e=>setEActive(e.target.value as any)}>
                <option>sí</option><option>no</option>
              </select>
            ) : (
              r.is_active ? <span className="badge" style={{background:'#16a34a22', color:'#166534'}}>En vigor</span>
                          : <span className="badge" style={{background:'#9ca3af22', color:'#374151'}}>No activo</span>
            )}
          </div>
          <div style={{flex:'1 1 30%'}}>
            {editId===r.id ? (
              <>
                <input type="file" accept="application/pdf" onChange={e=>setEFile(e.target.files?.[0] || null)}/>
                <div style={{display:'flex', gap:8, marginTop:8}}>
                  <Button onClick={onSaveEdit}>Guardar</Button>
                  <Button tone="neutral" onClick={()=>setEditId(null)}>Cancelar</Button>
                </div>
              </>
            ) : (
              <div style={{display:'flex', gap:8, justifyContent:'flex-end'}}>
                <Button tone="neutral" onClick={()=>beginEdit(r)}>Editar</Button>
                <Button tone="danger" onClick={()=>onDelete(r.id)}>Eliminar</Button>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* crear */}
      <div className="card" style={{marginTop:12}}>
        <h4 style={{marginTop:0}}>Añadir contrato</h4>
        <div className="row" style={{gap:8}}>
          <input placeholder="Nombre contrato" value={nName} onChange={e=>setNName(e.target.value)}/>
          <input type="date" value={nDate} onChange={e=>setNDate(e.target.value)}/>
          <select value={nActive} onChange={e=>setNActive(e.target.value as any)}>
            <option>sí</option><option>no</option>
          </select>
        </div>
        <div className="row" style={{gap:8, marginTop:8}}>
          <input type="file" accept="application/pdf" onChange={e=>setNFile(e.target.files?.[0] || null)}/>
          <Button onClick={onCreate}>Guardar contrato</Button>
        </div>
      </div>
    </div>
  );
}
