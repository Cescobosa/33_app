// components/SmartPartySelect.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';
import { matches, normalize } from '../lib/search';

type Props = {
  artistId: string;                 // artista al que se vincula
  kind: 'third' | 'provider';       // tipo
  onLinked?: () => void;            // callback tras crear/vincular
};

type Party = {
  id: string;
  artist_id: string | null;
  kind: 'third' | 'provider';
  nick: string | null;
  name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

export default function SmartPartySelect({ artistId, kind, onLinked }: Props) {
  const [query, setQuery] = useState('');
  const [existing, setExisting] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);

  // “Nuevo” (crear directamente)
  const [newNick, setNewNick] = useState('');
  const [newName, setNewName] = useState('');
  const [newTax, setNewTax] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    // Recupera terceros del propio artista para sugerir/reutilizar datos parecidos;
    // y también terceros globales del mismo tipo sin filtrar (puedes limitar a 50 para no cargar demasiado).
    const [a, b] = await Promise.all([
      supabase.from('third_parties')
        .select('*')
        .eq('artist_id', artistId)
        .eq('kind', kind)
        .order('created_at', { ascending:false }),
      supabase.from('third_parties')
        .select('*')
        .is('artist_id', null)
        .eq('kind', kind)
        .order('created_at', { ascending:false })
        .limit(50)
    ]);
    const list = ([...(a.data||[]), ...(b.data||[])] as Party[])
      .filter(p => p.is_active !== false);
    setExisting(list);
    setLoading(false);
  }

  useEffect(()=>{ load(); }, [artistId, kind]);

  const suggestions = useMemo(()=>{
    if (!query.trim()) return existing.slice(0, 10);
    return existing.filter(p =>
      matches(p.nick, query) ||
      matches(p.name, query) ||
      matches(p.tax_id, query)
    ).slice(0, 10);
  }, [existing, query]);

  async function linkExisting(id: string) {
    // Vinculamos este registro al artista (si estuviera suelto).
    const { error } = await supabase
      .from('third_parties')
      .update({ artist_id: artistId })
      .eq('id', id);
    if (error) return alert(error.message);
    onLinked?.();
    await load();
  }

  async function createNew() {
    if (saving) return;
    setSaving(true);
    try {
      // Evita colisiones de índice único si todo está vacío: metemos un nick “placeholder”
      const safeNick = (newNick || newName || newTax) ? newNick : `[nuevo] ${Math.random().toString(36).slice(2,8)}`;
      const ins = await supabase
        .from('third_parties')
        .insert({
          artist_id: artistId,
          kind,
          nick: safeNick || null,
          name: newName || null,
          tax_id: newTax || null,
          is_active: true
        })
        .select('*')
        .single();
      if (ins.error) throw ins.error;
      setNewNick(''); setNewName(''); setNewTax('');
      onLinked?.();
      await load();
    } catch (e:any) {
      alert(e.message || 'No se pudo crear');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{alignItems:'flex-end'}}>
        <div style={{flex:'1 1 360px'}}>
          <label>Buscar {kind==='third' ? 'tercero' : 'proveedor'}</label>
          <input
            placeholder="Nick, nombre o NIF/CIF…"
            value={query}
            onChange={e=>setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Sugerencias */}
      {loading ? <small>Cargando…</small> : null}
      {!loading && suggestions.length > 0 && (
        <div style={{marginTop:8}}>
          {suggestions.map(p=>(
            <div key={p.id} className="row" style={{alignItems:'center', borderTop:'1px solid #e5e7eb', paddingTop:8, marginTop:8}}>
              <div style={{flex:'1 1 auto'}}>
                <div style={{fontWeight:600}}>{p.nick || p.name || 'Sin nombre'}</div>
                <div style={{fontSize:12, color:'#6b7280'}}>{p.tax_id || '—'}</div>
              </div>
              <Button onClick={()=>linkExisting(p.id)}>Vincular</Button>
            </div>
          ))}
        </div>
      )}

      {/* Crear nuevo */}
      <div className="row" style={{marginTop:12}}>
        <div style={{flex:'1 1 220px'}}><label>Nick</label><input value={newNick} onChange={e=>setNewNick(e.target.value)} /></div>
        <div style={{flex:'1 1 280px'}}><label>Nombre/Empresa</label><input value={newName} onChange={e=>setNewName(e.target.value)} /></div>
        <div style={{flex:'0 0 220px'}}><label>NIF/CIF</label><input value={newTax} onChange={e=>setNewTax(e.target.value)} /></div>
      </div>
      <div style={{display:'flex', gap:8}}>
        <Button onClick={createNew} disabled={saving}>Guardar y crear</Button>
      </div>
    </div>
  );
}
