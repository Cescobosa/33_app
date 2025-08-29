import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';

type Props = {
  kind: 'artist' | 'third';
  ownerId: string; // artist_id o third_party_id
};

type ContractRow = {
  id: string;
  name: string | null;
  signed_at: string | null;
  active: boolean | null;
  file_url: string | null;
  created_at: string;
};

export default function ContractsBlock({ kind, ownerId }: Props) {
  const table = kind === 'artist' ? 'artist_contracts' : 'third_party_contracts';
  const fk = kind === 'artist' ? 'artist_id' : 'third_party_id';

  const [rows, setRows] = useState<ContractRow[]>([]);
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File|null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [active, setActive] = useState(true);
  const [err, setErr] = useState<string| null>(null);

  async function load() {
    const { data, error } = await supabase
      .from(table)
      .select('id,name,signed_at,active,file_url,created_at')
      .eq(fk, ownerId)
      .order('created_at', { ascending: false });
    if (error) setErr(error.message);
    setRows(data || []);
  }
  useEffect(()=>{ load(); }, [ownerId, table]);

  async function add() {
    setErr(null);
    try {
      if (!file) { setErr('Adjunta un PDF.'); return; }
      const extOk = file.name.toLowerCase().endsWith('.pdf');
      if (!extOk) { setErr('Sólo se aceptan PDF.'); return; }

      // 1) subimos a Storage (bucket 'contracts')
      const path = `${Date.now()}-${file.name}`;
      const up = await supabase.storage.from('contracts').upload(path, file, {contentType:'application/pdf'});
      if (up.error) throw up.error;

      // 2) URL firmada 1 año
      const signed = await supabase.storage.from('contracts').createSignedUrl(path, 60*60*24*365);
      if (signed.error || !signed.data) throw signed.error || new Error('No signed url');
      const url = signed.data.signedUrl;

      // 3) Insert en tabla (RLS ya abierto en SQL)
      const payload:any = { [fk]: ownerId, name: name || null, signed_at: date || null, active, file_url: url };
      const { error: insErr } = await supabase.from(table).insert(payload);
      if (insErr) throw insErr;

      setAdding(false);
      setFile(null); setName(''); setDate(''); setActive(true);
      await load();
    } catch (e:any) {
      setErr(e.message || 'Error al guardar el contrato');
    }
  }

  function needUpdate(r: ContractRow) {
    // Si falta algún dato clave, mostramos aviso
    return !r.name || !r.signed_at || r.active === null || !r.file_url;
  }

  return (
    <div>
      {/* Cabecera del bloque: botón a la IZQUIERDA */}
      <div style={{display:'flex', justifyContent:'flex-start', marginBottom:8}}>
        {!adding ? (
          <Button onClick={()=>setAdding(true)}>+ Añadir contrato</Button>
        ) : null}
      </div>

      {adding && (
        <div className="card" style={{marginBottom:10}}>
          <div className="row">
            <div style={{flex:'1 1 260px'}}><label>Nombre del contrato</label><input value={name} onChange={e=>setName(e.target.value)}/></div>
            <div style={{flex:'0 0 200px'}}><label>Fecha firma</label><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
            <div style={{flex:'0 0 200px'}}><label>Estado</label>
              <select value={active ? '1':'0'} onChange={e=>setActive(e.target.value==='1')}>
                <option value="1">En vigor</option>
                <option value="0">No vigente</option>
              </select>
            </div>
            <div style={{flex:'1 1 280px'}}><label>Archivo (PDF)</label>
              <input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0] ?? null)}/>
            </div>
          </div>
          {err ? <div style={{color:'#b91c1c', marginTop:6}}>{err}</div> : null}
          <div style={{display:'flex', gap:8}}>
            <Button onClick={add}>Guardar contrato</Button>
            <Button tone="neutral" onClick={()=>{ setAdding(false); setErr(null); setFile(null); setName(''); setDate(''); setActive(true); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {rows.length === 0 ? (
        <small>No hay contratos.</small>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:8}}>
          {rows.map(r=>(
            <div key={r.id} className="card">
              <div className="row" style={{alignItems:'center'}}>
                <div style={{flex:'1 1 280px'}}><strong>{r.name || 'Sin título'}</strong></div>
                <div style={{flex:'0 0 180px'}}>{r.signed_at || '—'}</div>
                <div style={{flex:'0 0 140px'}}>
                  {r.active ? <span className="tag" style={{background:'#10b981', color:'#fff'}}>En vigor</span>
                            : <span className="tag" style={{background:'#9ca3af', color:'#fff'}}>No vigente</span>}
                </div>
                <div style={{flex:'0 0 200px'}}>
                  {r.file_url ? <a href={r.file_url} target="_blank" rel="noreferrer">Descargar PDF</a> : '—'}
                </div>
              </div>

              {needUpdate(r) && (
                <div style={{marginTop:6, display:'inline-flex', alignItems:'center', gap:6, background:'#fef3c7', color:'#92400e', padding:'6px 10px', borderRadius:8}}>
                  <span>⚠️</span>
                  <span><strong>Necesario actualizar datos</strong></span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
