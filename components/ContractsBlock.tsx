import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';

const BUCKET_CONTRACTS = 'contracts';

type Kind = 'artist' | 'third';

type Contract = {
  id: string;
  name: string;
  signed_at: string | null;
  active: boolean;
  file_url: string;
  created_at: string;
};

type Props = {
  kind: Kind;
  ownerId: string; // artist_id o third_party_id
};

async function uploadAndSign(file: File) {
  const safe = file.name.normalize('NFC'); // tildes/ñ ok
  const name = `${Date.now()}-${safe}`;
  const { error: upErr } = await supabase.storage.from('contracts').upload(name, file);
  if (upErr) throw upErr;
  const { data, error: signErr } = await supabase
    .storage.from('contracts')
    .createSignedUrl(name, 60 * 60 * 24 * 365);
  if (signErr || !data) throw signErr || new Error('No signed URL');
  return data.signedUrl;
}

export default function ContractsBlock({ kind, ownerId }: Props) {
  const tbl = kind === 'artist' ? 'artist_contracts' : 'third_party_contracts';
  const fk = kind === 'artist' ? 'artist_id' : 'third_party_id';

  const [items, setItems] = useState<Contract[]>([]);
  const [showForm, setShowForm] = useState(false);

  // form
  const [name, setName] = useState('');
  const [date, setDate] = useState<string>('');
  const [active, setActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);

  async function load() {
    const { data } = await supabase
      .from(tbl)
      .select('*')
      .eq(fk, ownerId)
      .order('signed_at', { ascending: false })
      .order('created_at', { ascending: false });
    setItems((data || []) as any);
  }

  useEffect(() => {
    if (ownerId) load();
  }, [ownerId]);

  async function add() {
    if (!file || !name.trim()) return alert('Pon nombre y selecciona un PDF.');
    try {
      const file_url = await uploadAndSign(file);
      const { error } = await supabase.from(tbl).insert({
        [fk]: ownerId,
        name,
        signed_at: date || null,
        active,
        file_url,
      });
      if (error) throw error;
      setName(''); setDate(''); setActive(true); setFile(null);
      setShowForm(false);
      await load();
    } catch (e: any) {
      alert(e.message || 'Error subiendo contrato');
    }
  }

  async function toggleActive(id: string, value: boolean) {
    const { error } = await supabase.from(tbl).update({ active: value }).eq('id', id);
    if (!error) load();
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar contrato?')) return;
    const { error } = await supabase.from(tbl).delete().eq('id', id);
    if (!error) load();
  }

  return (
    <div>
      {/* Cabecera compacta: si no hay contratos, solo texto + botón */}
      {items.length === 0 ? (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <small>No hay contratos.</small>
          {!showForm && <Button onClick={()=>setShowForm(true)}>+ Añadir contrato</Button>}
        </div>
      ) : (
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          {!showForm && <Button onClick={()=>setShowForm(true)}>+ Añadir contrato</Button>}
        </div>
      )}

      {/* Formulario al pulsar */}
      {showForm && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="row" style={{ gap: 12 }}>
            <div style={{ flex: '1 1 240px' }}>
              <label>Nombre del contrato</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contrato marco" />
            </div>
            <div style={{ flex: '0 0 180px' }}>
              <label>Fecha firma</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div style={{ flex: '0 0 140px' }}>
              <label>En vigor</label>
              <select value={active ? 'sí' : 'no'} onChange={(e) => setActive(e.target.value === 'sí')}>
                <option>sí</option>
                <option>no</option>
              </select>
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <label>Archivo (PDF)</label>
              <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={add}>Guardar</Button>
            <Button tone="neutral" onClick={()=>{ setShowForm(false); setName(''); setDate(''); setActive(true); setFile(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div style={{ marginTop: 12 }}>
        {items.map((c) => (
          <div key={c.id} className="row" style={{ padding: '8px 0', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ flex: '1 1 240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>{c.name}</strong>
                {c.active && (
                  <span style={{ background: '#16a34a', color: 'white', fontSize: 12, borderRadius: 8, padding: '2px 8px' }}>
                    En Vigor
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                {c.signed_at ? `Firma: ${c.signed_at}` : 'Sin fecha'}
              </div>
            </div>
            <div>
              <a className="btn" href={c.file_url} target="_blank" rel="noreferrer">Ver PDF</a>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button tone="neutral" onClick={() => toggleActive(c.id, !c.active)}>
                {c.active ? 'Marcar como NO vigente' : 'Marcar En Vigor'}
              </Button>
              <Button tone="danger" onClick={() => remove(c.id)}>Eliminar</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
