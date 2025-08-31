// components/ThirdPartyPicker.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';
import ThirdForm from './ThirdForm';

type ThirdRow = {
  id: string;
  kind: 'third' | 'provider';
  nick: string | null;
  name: string | null;
  email?: string | null;
  phone?: string | null;
  tax_id?: string | null;
  logo_url?: string | null;
  artist_id?: string | null;
  is_active?: boolean | null;
};

type Props = {
  // Sólo queremos terceros para artistas (kind='third')
  artistId?: string;                   // si llega, al seleccionar/crear, se vincula
  onLinked?: (row: ThirdRow) => void;  // callback tras vincular
};

function norm(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function ThirdPartyPicker({ artistId, onLinked }: Props) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<ThirdRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    // Traemos los terceros (kind='third'), activos e inactivos, ya que puedes re-vincular
    const { data, error } = await supabase
      .from('third_parties')
      .select('id, kind, nick, name, email, phone, tax_id, logo_url, artist_id, is_active')
      .eq('kind', 'third')
      .order('nick', { ascending: true });

    if (error) setErr(error.message);
    else setRows((data || []) as ThirdRow[]);
    setLoading(false);
  }

  useEffect(()=>{ load(); }, []);

  const filtered = useMemo(()=>{
    const n = norm(q);
    if (!n) return rows;
    return rows.filter(r => {
      const a = norm(r.nick || '');
      const b = norm(r.name || '');
      const t = norm(r.tax_id || '');
      return a.includes(n) || b.includes(n) || t.includes(n);
    });
  }, [q, rows]);

  async function linkExisting(third: ThirdRow) {
    if (!artistId) { onLinked?.(third); return; }

    // Si ya está vinculado a este artista, listo;
    if (third.artist_id === artistId) { onLinked?.(third); return; }

    // Si el tercero estaba vinculado a otro artista, aquí deberías definir política.
    // Conforme a tu modelo actual, cada tercero pertenece a 1 artista.
    // Vamos a permitir “cambiar” la vinculación al artista actual.
    const { error } = await supabase
      .from('third_parties')
      .update({ artist_id: artistId, is_active: true })
      .eq('id', third.id);

    if (error) { alert(error.message); return; }
    onLinked?.({ ...third, artist_id: artistId, is_active: true });
    await load();
  }

  return (
    <div className="module" style={{marginTop:12}}>
      <div style={{display:'flex', gap:8, alignItems:'center'}}>
        <input
          placeholder="Buscar tercero por nick, nombre o NIF/CIF…"
          value={q}
          onChange={(e)=> setQ(e.target.value)}
          className="input"
          style={{flex:'1 1 auto'}}
        />
        <Button onClick={()=> setShowCreate(true)}>+ Crear nuevo</Button>
      </div>

      {loading && <div style={{marginTop:8}}>Cargando…</div>}
      {err && <div style={{marginTop:8, color:'#d42842'}}>Error: {err}</div>}

      {!loading && !err && (
        filtered.length === 0 ? (
          <div style={{marginTop:8, color:'#6b7280'}}>No hay resultados. Crea uno nuevo.</div>
        ) : (
          <ul style={{listStyle:'none', padding:0, marginTop:12}}>
            {filtered.slice(0, 20).map(r => (
              <li key={r.id} style={{display:'flex', alignItems:'center', gap:12, padding:'8px 0', borderTop:'1px solid #e5e7eb'}}>
                <div style={{width:40, height:40, borderRadius:10, overflow:'hidden', background:'#f3f4f6'}}>
                  {r.logo_url && <img src={r.logo_url} alt={r.nick || r.name || 'tercero'} style={{width:'100%', height:'100%', objectFit:'cover'}}/>}
                </div>
                <div style={{flex:'1 1 auto'}}>
                  <div style={{fontWeight:600}}>{r.nick || r.name || '(Sin nombre)'}</div>
                  <div style={{fontSize:12, color:'#6b7280'}}>{r.tax_id || '—'}</div>
                </div>
                <Button onClick={()=> linkExisting(r)}>Vincular</Button>
              </li>
            ))}
          </ul>
        )
      )}

      {/* Modal de creación (mismo formulario que en la sección de terceros) */}
      {showCreate && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.35)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999
        }}>
          <div style={{background:'#fff', borderRadius:14, padding:16, width:'min(720px, 96vw)'}}>
            <ThirdForm
              initial={{ kind:'third', artist_id: artistId || null }}
              onCreated={(row)=>{ setShowCreate(false); onLinked?.(row); load(); }}
              onCancel={()=> setShowCreate(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
