// components/SmartPartySelect.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';

type Props = {
  /** id del artista al que queremos vincular (obligatorio para kind="third") */
  artistId?: string;
  /** 'third' para terceros vinculados a artistas, 'provider' para proveedores sueltos */
  kind: 'third' | 'provider';
  /** callback opcional tras vincular/crear (para recargar ficha) */
  onLinked?: () => void;
};

/** Normaliza strings (quita tildes y baja a minúsculas) para comparar/buscar */
function norm(s: string | null | undefined): string {
  if (!s) return '';
  try {
    // Navegadores modernos
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  } catch {
    // Fallback simple
    const from = 'ÁÀÄÂÃÅáàäâãåÉÈËÊéèëêÍÌÏÎíìïîÓÒÖÔÕóòöôõÚÙÜÛúùüûÇçÑñ';
    const to   = 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn';
    return s.split('').map(ch => {
      const idx = from.indexOf(ch);
      return idx >= 0 ? to[idx] : ch;
    }).join('').toLowerCase().trim();
  }
}

type ThirdRow = {
  id: string;
  kind: 'third'|'provider';
  artist_id: string | null;
  nick: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

export default function SmartPartySelect({ artistId, kind, onLinked }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ThirdRow[]>([]);

  // Modal de “nuevo tercero”
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    nick: '',
    name: '',
    email: '',
    phone: '',
    tax_id: ''
  });

  const qn = useMemo(() => norm(q), [q]);
  const inputRef = useRef<HTMLInputElement|null>(null);

  /** Buscar en BD con ilike y después afinar en cliente con normalización */
  async function search(text: string) {
    const value = text.trim();
    setQ(value);
    const nv = norm(value);
    if (nv.length < 2) { setRows([]); return; }

    setLoading(true);
    try {
      // Traemos un máximo de 30 candidatos por nick o name (ilike) de este kind
      const { data, error } = await supabase
        .from('third_parties')
        .select('id, kind, artist_id, nick, name, email, phone, logo_url, is_active')
        .eq('kind', kind)
        .limit(30)
        .or(`nick.ilike.%${value}%,name.ilike.%${value}%`);

      if (error) throw error;

      const arr = (data || []) as ThirdRow[];

      // Filtro “fuzzy” por normalización para resolver tildes
      const filtered = arr.filter(r => {
        const a = norm(r.nick) || '';
        const b = norm(r.name) || '';
        return a.includes(nv) || b.includes(nv);
      });

      setRows(filtered);
    } catch (e: any) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function linkExisting(thirdId: string) {
    // Vincula el tercero al artista (y lo marca como activo)
    try {
      if (kind === 'third') {
        if (!artistId) {
          alert('Falta artistId para vincular el tercero.');
          return;
        }
        const { error } = await supabase
          .from('third_parties')
          .update({
            artist_id: artistId,
            unlinked: false,
            unlinked_at: null,
            unlinked_from_artist: null,
            is_active: true
          })
          .eq('id', thirdId);
        if (error) throw error;
      }
      setQ('');
      setRows([]);
      onLinked?.();
    } catch (e:any) {
      alert(e.message || 'No se pudo vincular el tercero');
    }
  }

  async function createAndLink() {
    if (!draft.nick.trim() && !draft.name.trim()) {
      alert('Pon al menos Nick o Nombre');
      return;
    }
    try {
      setCreating(true);

      // Comprobación blanda de duplicados (misma idea que tu índice "soft")
      const base = (draft.nick || draft.name || '').trim();
      const { data: dup } = await supabase
        .from('third_parties')
        .select('id, nick, name')
        .eq('kind', kind)
        .limit(1)
        .or(`nick.ilike.%${base}%,name.ilike.%${base}%`);
      if ((dup || []).length > 0) {
        // Ya existe uno muy parecido -> ofrecérselo directamente
        const ya = dup![0];
        const ok = confirm(`Ya existe “${ya.nick || ya.name}”. ¿Vincular ese?`);
        if (ok) {
          await linkExisting(ya.id);
          setShowCreate(false);
          setDraft({ nick:'', name:'', email:'', phone:'', tax_id:'' });
          return;
        }
      }

      // Insert del tercero (si hay artistId y kind='third', lo dejamos ya vinculado)
      const payload: any = {
        kind,
        nick: draft.nick || null,
        name: draft.name || null,
        email: draft.email || null,
        phone: draft.phone || null,
        tax_id: draft.tax_id || null,
        is_active: true,
      };
      if (kind === 'third' && artistId) payload.artist_id = artistId;

      const ins = await supabase.from('third_parties').insert(payload).select('id').single();
      if (ins.error) throw ins.error;

      // Si es provider no lo vinculamos a un artista
      if (kind === 'third' && artistId && !payload.artist_id) {
        await linkExisting(ins.data.id);
      }

      setShowCreate(false);
      setDraft({ nick:'', name:'', email:'', phone:'', tax_id:'' });
      setQ('');
      setRows([]);
      onLinked?.();
    } catch (e:any) {
      alert(e.message || 'No se pudo crear el tercero');
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    // Al montar, autofocus si procede
    if (inputRef.current) inputRef.current.focus();
  }, []);

  return (
    <div>
      <input
        ref={inputRef}
        placeholder="Busca por nick o nombre…"
        value={q}
        onChange={(e)=>search(e.target.value)}
      />

      {/* Resultados */}
      {loading ? <div style={{marginTop:8}}>Buscando…</div> : null}

      {!loading && qn.length >= 2 && rows.length > 0 && (
        <div style={{marginTop:8, display:'grid', gap:8}}>
          {rows.map(r=>(
            <div key={r.id} className="card" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap:12}}>
                <div style={{width:36, height:36, borderRadius:8, overflow:'hidden', background:'#f3f4f6'}}>
                  {r.logo_url ? <img src={r.logo_url} alt={r.nick||r.name||''} style={{width:'100%',height:'100%',objectFit:'cover'}}/> : null}
                </div>
                <div>
                  <div style={{fontWeight:600}}>{r.nick || r.name || 'Sin nombre'}</div>
                  <div style={{fontSize:12, color:'#6b7280'}}>{r.email || r.phone || ''}</div>
                </div>
              </div>
              <div>
                <Button onClick={()=>linkExisting(r.id)}>Vincular</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Si no hay resultados y hay texto => opción de crear */}
      {!loading && qn.length >= 2 && rows.length === 0 && (
        <div style={{marginTop:8}}>
          <small>No hay resultados.</small>
          <div style={{marginTop:8}}>
            <Button tone="danger" onClick={()=>{ setShowCreate(true); setDraft({nick:q, name:'', email:'', phone:'', tax_id:''}); }}>
              + Crear nuevo tercero
            </Button>
          </div>
        </div>
      )}

      {/* Modal inline para crear tercero (ligero y sin dependencias) */}
      {showCreate && (
        <div
          style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,.35)',
            display:'flex', alignItems:'center', justifyContent:'center', zIndex:50
          }}
          onClick={()=>setShowCreate(false)}
        >
          <div
            className="module"
            style={{width:'min(720px, 94vw)', maxWidth:720, background:'#fff'}}
            onClick={(e)=>e.stopPropagation()}
          >
            <h3 style={{marginTop:0}}>Nuevo tercero</h3>
            <div className="row">
              <div style={{flex:'1 1 240px'}}><label>Nick</label>
                <input value={draft.nick} onChange={e=>setDraft({...draft, nick:e.target.value})}/>
              </div>
              <div style={{flex:'1 1 320px'}}><label>Nombre / Empresa</label>
                <input value={draft.name} onChange={e=>setDraft({...draft, name:e.target.value})}/>
              </div>
              <div style={{flex:'0 0 220px'}}><label>NIF/CIF</label>
                <input value={draft.tax_id} onChange={e=>setDraft({...draft, tax_id:e.target.value})}/>
              </div>
            </div>
            <div className="row">
              <div style={{flex:'1 1 280px'}}><label>Email</label>
                <input value={draft.email} onChange={e=>setDraft({...draft, email:e.target.value})}/>
              </div>
              <div style={{flex:'0 0 200px'}}><label>Teléfono</label>
                <input value={draft.phone} onChange={e=>setDraft({...draft, phone:e.target.value})}/>
              </div>
            </div>

            <div style={{display:'flex', gap:8, marginTop:10}}>
              <Button onClick={createAndLink} disabled={creating}>
                Guardar{kind==='third' && artistId ? ' y vincular' : ''}
              </Button>
              <Button tone="neutral" onClick={()=>setShowCreate(false)}>Cancelar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
