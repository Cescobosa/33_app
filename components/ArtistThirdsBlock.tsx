import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';

type Third = {
  id: string;
  artist_id: string | null;
  kind: 'third'|'provider';
  nick: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

function normalize(s: string) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function ArtistThirdsBlock({ artistId }: { artistId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Third[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  const [linked, setLinked] = useState<Third[]>([]);
  const [loadingLinked, setLoadingLinked] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ nick: '', name: '', email: '', phone: '', tax_id: '' });

  async function loadLinked() {
    setLoadingLinked(true);
    const { data, error } = await supabase
      .from('third_parties')
      .select('id, artist_id, kind, nick, name, email, phone, logo_url, is_active')
      .eq('kind', 'third')
      .eq('artist_id', artistId)
      .order('nick', { ascending: true });
    if (!error) setLinked((data || []) as any);
    setLoadingLinked(false);
  }
  useEffect(() => { loadLinked(); }, [artistId]);

  useEffect(() => {
    const t = setTimeout(() => { search(query); }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function search(q: string) {
    if (!q?.trim()) { setResults([]); return; }
    setLoadingSearch(true);
    const term = q.trim();

    // 1) Reducimos con OR ILIKE en BBDD
    const { data, error } = await supabase
      .from('third_parties')
      .select('id, artist_id, kind, nick, name, email, phone, logo_url, is_active')
      .eq('kind', 'third')
      .or(`nick.ilike.%${term}%,name.ilike.%${term}%,tax_id.ilike.%${term}%`)
      .limit(50);

    // 2) Filtrado sin tildes en cliente (para "Máquina" ~ "maquina")
    const nterm = normalize(term);
    const rows = (data || []) as Third[];
    const filtered = rows.filter(r => {
      const hay = `${normalize(r.nick || '')} ${normalize(r.name || '')} ${normalize(r.email || '')} ${normalize(r.phone || '')}`;
      return hay.includes(nterm);
    });

    setResults(filtered);
    setLoadingSearch(false);
  }

  async function linkThird(third: Third) {
    if (third.artist_id === artistId) { alert('Ya está vinculado a este artista.'); return; }
    if (third.artist_id && third.artist_id !== artistId) {
      const ok = confirm('Este tercero está vinculado a otro artista. ¿Quieres moverlo aquí?');
      if (!ok) return;
    }
    const { error } = await supabase
      .from('third_parties')
      .update({ artist_id: artistId, kind: 'third', is_active: true, unlinked: false, unlinked_at: null })
      .eq('id', third.id);
    if (error) { alert(error.message); return; }
    setQuery('');
    setResults([]);
    await loadLinked();
  }

  async function createAndLink() {
    if (!form.nick && !form.name) { alert('Pon un nick o un nombre.'); return; }

    // dedupe rápido: si ya existe (por nick/nombre/tax_id), se vincula en lugar de crear duplicado
    const probe = form.tax_id || form.nick || form.name || '';
    const { data: existing } = await supabase
      .from('third_parties')
      .select('id, nick, name, artist_id, kind')
      .eq('kind', 'third')
      .or(`tax_id.ilike.%${probe}%,nick.ilike.%${probe}%,name.ilike.%${probe}%`)
      .limit(10);

    const nprobe = normalize(probe);
    const match = (existing || []).find(r => {
      const bag = `${normalize(r.nick || '')} ${normalize(r.name || '')}`;
      return nprobe && bag.includes(nprobe);
    });

    if (match) {
      await linkThird(match as any);
      setShowCreate(false);
      setForm({ nick: '', name: '', email: '', phone: '', tax_id: '' });
      return;
    }

    // crear y vincular
    const ins = await supabase
      .from('third_parties')
      .insert({
        kind: 'third',
        artist_id: artistId,
        nick: form.nick || null,
        name: form.name || null,
        email: form.email || null,
        phone: form.phone || null,
        tax_id: form.tax_id || null,
        is_active: true
      })
      .select('*')
      .single();

    if (ins.error) { alert(ins.error.message); return; }
    setShowCreate(false);
    setForm({ nick: '', name: '', email: '', phone: '', tax_id: '' });
    setQuery('');
    await loadLinked();
  }

  async function unlink(thirdId: string) {
    if (!confirm('¿Desvincular este tercero del artista?')) return;
    const { error } = await supabase
      .from('third_parties')
      .update({
        artist_id: null,
        unlinked: true,
        unlinked_at: new Date().toISOString(),
        unlinked_from_artist_id: artistId
      })
      .eq('id', thirdId);
    if (error) { alert(error.message); return; }
    await loadLinked();
  }

  return (
    <div className="module">
      <h2 style={{ marginTop: 0 }}>Terceros vinculados</h2>

      {/* Buscador + crear */}
      <div className="card" style={{ marginBottom: 8 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 420px' }}>
            <label>Buscar o añadir tercero</label>
            <input
              placeholder="Escribe para buscar (tildes opcionales)…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div style={{ flex: '0 0 auto' }}>
            <Button tone="neutral" onClick={() => setShowCreate(s => !s)}>
              {showCreate ? 'Cerrar' : '+ Crear nuevo'}
            </Button>
          </div>
        </div>

        {/* resultados de búsqueda */}
        {query && (
          <div style={{ marginTop: 10 }}>
            {loadingSearch ? (
              <small>Buscando…</small>
            ) : results.length === 0 ? (
              <small>No hay resultados. Puedes crearlo.</small>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {results.map(r => (
                  <div key={r.id} className="row" style={{ alignItems: 'center' }}>
                    <div style={{ flex: '1 1 auto' }}>
                      <strong>{r.nick || r.name || 'Sin nombre'}</strong>
                      <span style={{ color: '#6b7280', marginLeft: 8, fontSize: 12 }}>
                        {r.email || '—'} · {r.phone || '—'}
                      </span>
                      {r.artist_id && r.artist_id !== artistId ? (
                        <span className="badge" style={{ marginLeft: 8, background: '#fde68a', color: '#92400e' }}>
                          vinculado a otro
                        </span>
                      ) : null}
                      {r.artist_id === artistId ? (
                        <span className="badge" style={{ marginLeft: 8, background: '#d1fae5', color: '#065f46' }}>
                          ya vinculado
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <Button onClick={() => linkThird(r)} disabled={r.artist_id === artistId}>
                        {r.artist_id && r.artist_id !== artistId ? 'Mover aquí' : 'Vincular'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* formulario de alta rápido */}
        {showCreate && (
          <div className="card" style={{ marginTop: 10 }}>
            <div className="row">
              <div style={{ flex: '1 1 200px' }}>
                <label>Nick</label>
                <input value={form.nick} onChange={e => setForm({ ...form, nick: e.target.value })} />
              </div>
              <div style={{ flex: '1 1 260px' }}>
                <label>Nombre/Compañía</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div style={{ flex: '0 0 160px' }}>
                <label>NIF/CIF</label>
                <input value={form.tax_id} onChange={e => setForm({ ...form, tax_id: e.target.value })} />
              </div>
              <div style={{ flex: '1 1 220px' }}>
                <label>Email</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div style={{ flex: '0 0 160px' }}>
                <label>Teléfono</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={createAndLink}>Guardar y vincular</Button>
              <Button
                tone="neutral"
                onClick={() => { setShowCreate(false); setForm({ nick: '', name: '', email: '', phone: '', tax_id: '' }); }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* lista de terceros ya vinculados */}
      {loadingLinked ? (
        <small>Cargando terceros vinculados…</small>
      ) : linked.length === 0 ? (
        <small>No hay terceros vinculados.</small>
      ) : (
        <div style={{ marginTop: 8, display: 'grid', gap: 8 }}>
          {linked.map(t => (
            <div key={t.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', background: '#f3f4f6' }}>
                  {t.logo_url ? (
                    <img src={t.logo_url} alt={t.nick || t.name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : null}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.nick || t.name || 'Sin nombre'}</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{t.email || '—'} · {t.phone || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button as="a" tone="neutral" href={`/partners/thirds/${t.id}`}>Editar</Button>
                <Button tone="danger" onClick={() => unlink(t.id)}>Desvincular</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
