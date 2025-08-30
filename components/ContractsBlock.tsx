// components/ContractsBlock.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';

type Kind = 'artist' | 'third';

type Row = {
  id: string;
  name: string | null;
  signed_at: string | null; // date
  file_url: string | null;
  active: boolean | null;
  created_at: string;
};

const BUCKET_CONTRACTS = 'contracts';

function hasMissing(r: Row) {
  return !r.name || !r.file_url || r.active === null || r.active === undefined;
}

async function uploadPdf(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
  if (ext !== 'pdf') throw new Error('Solo se admiten archivos PDF');
  const key = `${Date.now()}-${file.name}`; // conserva tildes/ñ
  const { error: upErr } = await supabase.storage.from(BUCKET_CONTRACTS).upload(key, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'application/pdf',
  });
  if (upErr) throw upErr;
  const { data, error: signErr } = await supabase.storage
    .from(BUCKET_CONTRACTS)
    .createSignedUrl(key, 60 * 60 * 24 * 365);
  if (signErr || !data) throw signErr || new Error('No se pudo firmar URL');
  return data.signedUrl;
}

export default function ContractsBlock({ kind, ownerId }: { kind: Kind; ownerId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [signedAt, setSignedAt] = useState('');
  const [active, setActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const table = kind === 'artist' ? 'artist_contracts' : 'third_party_contracts';
    const fk = kind === 'artist' ? 'artist_id' : 'third_party_id';
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq(fk, ownerId)
      .order('created_at', { ascending: false });
    if (error) setErr(error.message);
    setRows((data || []) as any);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, ownerId]);

  async function onAdd() {
    setErr(null);
    if (!file) return setErr('Adjunta el PDF del contrato.');
    if (!name.trim()) return setErr('Pon el nombre del contrato.');

    try {
      setBusy(true);
      const file_url = await uploadPdf(file);

      const table = kind === 'artist' ? 'artist_contracts' : 'third_party_contracts';
      const payload: any = {
        name,
        signed_at: signedAt || null,
        active,
        file_url,
      };
      if (kind === 'artist') payload.artist_id = ownerId;
      else payload.third_party_id = ownerId;

      const { error } = await supabase.from(table).insert(payload);
      if (error) throw error;

      setAdding(false);
      setName('');
      setSignedAt('');
      setActive(true);
      setFile(null);
      await load();
    } catch (e: any) {
      setErr(e.message || 'Error guardando contrato');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {rows.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <small>No hay contratos.</small>
          {!adding && (
            <Button onClick={() => setAdding(true)} icon="plus">
              Añadir contrato
            </Button>
          )}
        </div>
      ) : null}

      {rows.map((r) => (
        <div key={r.id} className="card" style={{ marginBottom: 8 }}>
          <div className="row" style={{ alignItems: 'center' }}>
            <div style={{ flex: '1 1 auto' }}>
              <div style={{ fontWeight: 600 }}>{r.name || '—'}</div>
              <div style={{ color: '#6b7280', fontSize: 12 }}>
                {r.signed_at ? `Firmado: ${r.signed_at}` : 'Sin fecha'}
              </div>
            </div>
            {r.active ? (
              <span style={{ background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: 8 }}>
                En vigor
              </span>
            ) : (
              <span style={{ background: '#9ca3af', color: '#fff', padding: '2px 6px', borderRadius: 8 }}>
                No vigente
              </span>
            )}
          </div>

          {hasMissing(r) && (
            <div
              style={{
                marginTop: 6,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#fbbf24',
                color: '#111827',
                padding: '2px 8px',
                borderRadius: 8,
                fontSize: 12,
              }}
              title="Actualiza los datos del contrato"
            >
              ⚠️ Necesario actualizar datos
            </div>
          )}

          {r.file_url ? (
            <div style={{ marginTop: 6 }}>
              <a href={r.file_url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>
                Ver contrato (PDF)
              </a>
            </div>
          ) : null}
        </div>
      ))}

      {/* Formulario inline de alta */}
      {adding && (
        <div className="card" style={{ marginTop: 8 }}>
          <div className="row">
            <div style={{ flex: '1 1 280px' }}>
              <label>Nombre del contrato</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div style={{ flex: '0 0 180px' }}>
              <label>Fecha de firma</label>
              <input type="date" value={signedAt} onChange={(e) => setSignedAt(e.target.value)} />
            </div>
            <div style={{ flex: '0 0 160px' }}>
              <label>¿En vigor?</label>
              <select value={active ? 'sí' : 'no'} onChange={(e) => setActive(e.target.value === 'sí')}>
                <option>sí</option>
                <option>no</option>
              </select>
            </div>
            <div style={{ flex: '1 1 320px' }}>
              <label>Archivo (PDF)</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {err ? (
            <div style={{ color: '#d42842', marginTop: 8 }}>{err}</div>
          ) : null}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button onClick={onAdd} disabled={busy} icon="plus">
              Guardar contrato
            </Button>
            <Button tone="neutral" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Botón de añadir cuando existen contratos */}
      {!adding && rows.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Button onClick={() => setAdding(true)} icon="plus">
            Añadir contrato
          </Button>
        </div>
      )}
    </div>
  );
}
