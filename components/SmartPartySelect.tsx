// components/SmartPartySelect.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';

type Props = {
  artistId: string;                  // artista al que vamos a vincular
  kind: 'third' | 'provider';        // tipo de ficha a buscar/crear
  onLinked?: () => void;             // callback tras vincular
};

type ThirdLite = {
  id: string;
  artist_id: string | null;
  kind: 'third' | 'provider';
  nick: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

// --- util acento-insensible ---
function norm(s?: string | null) {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function SmartPartySelect({ artistId, kind, onLinked }: Props) {
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ThirdLite[]>([]);
  const [error, setError] = useState<string | null>(null);

  // formulario de alta inline
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    nick: '',
    name: '',
    email: '',
    phone: '',
    tax_id: '',
  });

  // debounce de búsqueda
  const tRef = useRef<any>(null);
  useEffect(() => {
    clearTimeout(tRef.current);
    tRef.current = setTimeout(() => {
      void doSearch(q);
    }, 250);
    return () => clearTimeout(tRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind]);

  async function doSearch(term: string) {
    setError(null);
    setBusy(true);
    try {
      const base = supabase
        .from('third_parties')
        .select('id, artist_id, kind, nick, name, email, phone, tax_id, logo_url, is_active')
        .eq('kind', kind)
        .neq('is_active', false)
        .order('created_at', { ascending: false })
        .limit(40);

      if (!term.trim()) {
        const { data, error } = await base;
        if (error) throw error;
        setResults(data || []);
        return;
      }

      // 1) intento directo por ILIKE en columnas más habituales
      const { data: byIlike, error: e1 } = await base.or(
        [
          `nick.ilike.%${term}%`,
          `name.ilike.%${term}%`,
          `email.ilike.%${term}%`,
          `phone.ilike.%${term}%`,
          `tax_id.ilike.%${term}%`,
        ].join(',')
      );
      if (e1) throw e1;

      if (byIlike && byIlike.length > 0) {
        setResults(byIlike);
      } else {
        // 2) fallback: traemos un bloque y filtramos en cliente SIN acentos
        const { data: all, error: e2 } = await supabase
          .from('third_parties')
          .select('id, artist_id, kind, nick, name, email, phone, tax_id, logo_url, is_active')
          .eq('kind', kind)
          .neq('is_active', false)
          .limit(250);
        if (e2) throw e2;

        const n = norm(term);
        const filtered = (all || []).filter((t) => {
          const hay = [t.nick, t.name, t.email, t.phone, t.tax_id].some((v) => norm(v).includes(n));
          return hay;
        });
        setResults(filtered);
      }
    } catch (e: any) {
      setError(e.message || 'Error buscando terceros');
    } finally {
      setBusy(false);
    }
  }

  async function linkExisting(thirdId: string) {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('third_parties')
        .update({
          artist_id: artistId,
          unlinked: false,
          unlinked_at: null,
          unlinked_from_artist: null,
        })
        .eq('id', thirdId);
      if (error) throw error;
      // refrescamos resultados y avisamos arriba
      await doSearch(q);
      onLinked?.();
    } catch (e: any) {
      setError(e.message || 'No se pudo vincular');
    } finally {
      setBusy(false);
    }
  }

  // Comprobación de duplicados "suave"
  async function findPossibleDuplicate() {
    const keys = [form.nick, form.name, form.email, form.phone, form.tax_id].map(norm).filter(Boolean);
    if (keys.length === 0) return null;

    const { data, error } = await supabase
      .from('third_parties')
      .select('id, artist_id, kind, nick, name, email, phone, tax_id, logo_url, is_active')
      .eq('kind', kind)
      .neq('is_active', false)
      .limit(250);

    if (error) throw error;

    const dup = (data || []).find((t) => {
      const pool = [t.nick, t.name, t.email, t.phone, t.tax_id].map(norm);
      return keys.some((k) => k && pool.some((p) => p === k || (k.length > 2 && p.includes(k))));
    });
    return dup || null;
  }

  async function createAndLink() {
    setBusy(true);
    setError(null);
    try {
      // 0) validación mínima
      if (!form.nick.trim() && !form.name.trim()) {
        throw new Error('Indica al menos Nick o Nombre.');
      }

      // 1) ¿existe uno muy parecido?
      const dup = await findPossibleDuplicate();
      if (dup) {
        // si existe, lo vinculamos directamente
        await linkExisting(dup.id);
        setCreating(false);
        return;
      }

      // 2) creamos
      const { data: ins, error: insErr } = await supabase
        .from('third_parties')
        .insert({
          kind,
          artist_id: artistId,
          nick: form.nick || null,
          name: form.name || null,
          email: form.email || null,
          phone: form.phone || null,
          tax_id: form.tax_id || null,
          is_active: true,
        })
        .select('id')
        .single();

      if (insErr) throw insErr;

      // 3) listo
      setCreating(false);
      setForm({ nick: '', name: '', email: '', phone: '', tax_id: '' });
      setQ('');
      await doSearch('');
      onLinked?.();
    } catch (e: any) {
      setError(e.message || 'No se pudo crear el tercero');
    } finally {
      setBusy(false);
    }
  }

  const showCreateButton = useMemo(
    () => q.trim().length > 1 && results.length === 0,
    [q, results.length]
  );

  return (
    <div>
      <input
        placeholder="Busca por nick, nombre, CIF/NIF, email o teléfono…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {error ? (
        <div style={{ color: '#b91c1c', marginTop: 6 }}>{error}</div>
      ) : null}

      {/* Lista de resultados */}
      <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
        {busy && <small>Buscando…</small>}
        {!busy && results.length === 0 && <small>No hay resultados.</small>}

        {results.map((t) => {
          const display = t.nick || t.name || 'Sin nombre';
          const yaVinculado = t.artist_id === artistId;
          return (
            <div key={t.id} className="card" style={{ padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, overflow: 'hidden', background: '#f3f4f6' }}>
                  {t.logo_url ? (
                    <img src={t.logo_url} alt={display} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{display}</div>
                  <div style={{ color: '#6b7280', fontSize: 12 }}>
                    {t.email || '—'} · {t.phone || '—'} {t.tax_id ? `· ${t.tax_id}` : ''}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {yaVinculado ? (
                  <Button tone="neutral" disabled>Ya vinculado</Button>
                ) : (
                  <Button onClick={() => linkExisting(t.id)}>Vincular</Button>
                )}
                <Button as="a" tone="neutral" href={`/partners/thirds/${t.id}`}>Ver ficha</Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Botón de crear si no hay resultados claros */}
      {showCreateButton && !creating && (
        <div style={{ marginTop: 10 }}>
          <Button tone="danger" onClick={() => setCreating(true)}>+ Crear nuevo tercero</Button>
        </div>
      )}

      {/* Formulario inline de alta */}
      {creating && (
        <div className="card" style={{ marginTop: 10, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Nuevo tercero</h3>
          <div className="row">
            <div style={{ flex: '1 1 220px' }}>
              <label>Nick</label>
              <input
                value={form.nick}
                onChange={(e) => setForm({ ...form, nick: e.target.value })}
              />
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <label>Nombre / Empresa</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div style={{ flex: '0 0 220px' }}>
              <label>Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div style={{ flex: '0 0 180px' }}>
              <label>Teléfono</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div style={{ flex: '0 0 180px' }}>
              <label>NIF/CIF</label>
              <input
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Button onClick={createAndLink} disabled={busy}>Guardar y vincular</Button>
            <Button tone="neutral" onClick={() => setCreating(false)} disabled={busy}>Cancelar</Button>
          </div>

          {error ? (
            <div style={{ color: '#b91c1c', marginTop: 6 }}>{error}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
