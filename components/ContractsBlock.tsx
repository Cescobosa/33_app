// components/ContractsBlock.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';

type Kind = 'artist'|'third';

type ContractRow = {
  id: string;
  name: string | null;
  signed_at: string | null;
  is_active: boolean | null;
  file_url: string | null;
  created_at: string;
};

type Props = {
  kind: Kind;
  ownerId: string;
};

const BUCKET = 'contracts';

export default function ContractsBlock({ kind, ownerId }: Props) {
  const [rows, setRows] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);

  // UI: formulario oculto hasta pulsar
  const [openForm, setOpenForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newActive, setNewActive] = useState(true);
  const [newFile, setNewFile] = useState<File | null>(null);

  const table = kind === 'artist' ? 'artist_contracts' : 'third_party_contracts';
  const fk = kind === 'artist' ? 'artist_id' : 'third_party_id';

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(fk, ownerId)
      .order('created_at', { ascending: false });
    if (!error) setRows((data ?? []) as any);
    setLoading(false);
  }

  useEffect(() => { load(); }, [ownerId, kind]);

  async function uploadAndSign(file: File) {
    const path = `${Date.now()}-${file.name}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file);
    if (up.error) throw up.error;
    const sign = await supabase.storage.from(BUCKET).createSignedUrl(path, 60*60*24*365);
    if (sign.error || !sign.data) throw sign.error || new Error('No signed URL');
    return sign.data.signedUrl;
  }

  async function onCreate() {
    if (!newFile) return alert('Adjunta un PDF.');
    try {
      const file_url = await uploadAndSign(newFile);
      const ins = await supabase.from(table).insert({
        [fk]: ownerId,
        name: newName || null,
        signed_at: newDate || null,
        is_active: newActive,
        file_url,
      }).select('*').single();
      if (ins.error) throw ins.error;
      setOpenForm(false);
      setNewFile(null);
      setNewName(''); setNewDate(''); setNewActive(true);
      await load();
    } catch (e: any) {
      alert(e.message || 'Error al crear contrato');
    }
  }

  async function onDelete(id: string) {
    const sure = prompt('Escribe ELIMINAR para borrar este contrato');
    if (sure !== 'ELIMINAR') return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return alert(error.message);
    await load();
  }

  return (
    <div>
      {/* Listado */}
      {loading ? <small>Cargando…</small> : null}
      {!loading && rows.length === 0 ? <small>No hay contratos.</small> : null}
      {!loading && rows.length > 0 && (
        <div style={{ display:'grid', gap:8 }}>
          {rows.map(r=>(
            <div key={r.id} className="card" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div>
                <div style={{fontWeight:600}}>{r.name || 'Sin nombre'}</div>
                <div style={{fontSize:12, color:'#6b7280'}}>
                  {r.signed_at ? `Firma: ${r.signed_at}` : 'Sin fecha'}
                  {' · '}
                  {r.is_active ? <span style={{color:'#059669'}}>En vigor</span> : <span>No vigente</span>}
                </div>
              </div>
              <div style={{display:'flex', gap:8}}>
                {r.file_url ? <a className="btn" href={r.file_url} target="_blank" rel="noreferrer">Ver PDF</a> : null}
                {/* Si ya tenéis un flujo de edición, mantenlo; aquí nos centramos en el refactor visual */}
                <Button tone="danger" onClick={()=>onDelete(r.id)}>Eliminar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botón para desplegar formulario */}
      <div style={{ marginTop:12 }}>
        {!openForm ? (
          <Button onClick={()=>setOpenForm(true)}>+ Añadir contrato</Button>
        ) : (
          <div className="card">
            <div className="row">
              <div style={{flex:'1 1 280px'}}><label>Nombre del contrato</label>
                <input value={newName} onChange={e=>setNewName(e.target.value)} />
              </div>
              <div style={{flex:'0 0 220px'}}><label>Fecha de firma</label>
                <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)}/>
              </div>
              <div style={{flex:'0 0 160px'}}><label>¿En vigor?</label>
                <select value={newActive?'sí':'no'} onChange={e=>setNewActive(e.target.value==='sí')}>
                  <option>sí</option><option>no</option>
                </select>
              </div>
              <div style={{flex:'1 1 320px'}}><label>Archivo (PDF)</label>
                <input type="file" accept="application/pdf" onChange={e=>setNewFile(e.target.files?.[0] ?? null)}/>
              </div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <Button onClick={onCreate}>Guardar contrato</Button>
              <Button tone="neutral" onClick={()=>{ setOpenForm(false); setNewFile(null);} }>Cancelar</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
