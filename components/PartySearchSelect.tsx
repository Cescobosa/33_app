// components/PartySearchSelect.tsx
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';

type Third = {
  id: string;
  kind: 'third'|'provider';
  nick: string|null;
  name: string|null;
  tax_id: string|null;
  email: string|null;
  phone: string|null;
  logo_url: string|null;
  is_deleted?: boolean|null;
};

type Props = {
  label?: string;
  mode: 'third' | 'provider' | 'both';   // qué buscar/crear
  onPicked: (row: Third) => void;        // devuelve el registro elegido/creado
};

const normalize = (s?: string|null) => (s || '').trim().toLowerCase();

export default function PartySearchSelect({ label='Añadir', mode, onPicked }: Props) {
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Third[]>([]);
  const [inlineNew, setInlineNew] = useState(false);
  const [newRow, setNewRow] = useState<Partial<Third>>({
    kind: mode === 'provider' ? 'provider' : 'third',
    nick: '', name: '', tax_id: '', email: '', phone: ''
  });

  const canCreate = useMemo(() => q.trim().length>1 && rows.length===0, [q, rows]);

  async function search() {
    setLoading(true);
    let query = supabase.from('third_parties')
      .select('id, kind, nick, name, tax_id, email, phone, logo_url, is_deleted')
      .eq('is_deleted', false);

    if (mode !== 'both') query = query.eq('kind', mode);

    const { data } = await query.ilike('nick', `%${q}%`).limit(12);
    const { data: data2 } = await query.ilike('name', `%${q}%`).limit(12);

    // merge por id
    const map = new Map<string, Third>();
    (data||[]).forEach(r=>map.set(r.id, r as any));
    (data2||[]).forEach(r=>map.set(r.id, r as any));
    setRows(Array.from(map.values()));
    setLoading(false);
  }

  useEffect(()=>{ if (q.trim()) { const t = setTimeout(search, 250); return ()=>clearTimeout(t); } else setRows([]); }, [q]);

  async function createOrReuse() {
    const nn = normalize(newRow.nick as string);
    const nm = normalize(newRow.name as string);
    const nt = normalize(newRow.tax_id as string);

    // 1) ¿ya existe? -> reusar
    let q1 = supabase.from('third_parties')
      .select('id, kind, nick, name, tax_id, email, phone, logo_url')
      .eq('is_deleted', false);

    if (mode !== 'both') q1 = q1.eq('kind', mode);

    const { data: existing } = await q1.or(
      `nick.ilike.%${nn}%,name.ilike.%${nm}%,tax_id.ilike.%${nt}%`
    ).limit(1);

    if ((existing||[]).length>0) { onPicked(existing![0] as any); reset(); return; }

    // 2) crear
    const payload = {
      kind: (newRow.kind || (mode==='provider'?'provider':'third')) as any,
      nick: (newRow.nick||'').trim() || null,
      name: (newRow.name||'').trim() || null,
      tax_id: (newRow.tax_id||'').trim() || null,
      email: (newRow.email||'').trim() || null,
      phone: (newRow.phone||'').trim() || null,
      is_deleted: false
    };

    const { data: created, error } = await supabase
      .from('third_parties')
      .insert(payload)
      .select('id, kind, nick, name, tax_id, email, phone, logo_url')
      .single();

    if (error && (error as any).code === '23505') {
      // conflicto por índice único: reusar el ya existente
      const { data: again } = await supabase
        .from('third_parties')
        .select('id, kind, nick, name, tax_id, email, phone, logo_url')
        .eq('is_deleted', false)
        .or(`nick.eq.${payload.nick||''},name.eq.${payload.name||''},tax_id.eq.${payload.tax_id||''}`)
        .limit(1);
      if ((again||[]).length>0) { onPicked(again![0] as any); reset(); return; }
    }
    if (created) { onPicked(created as any); reset(); }
  }

  function reset() {
    setQ(''); setRows([]); setInlineNew(false);
    setNewRow({ kind: mode==='provider'?'provider':'third', nick:'', name:'', tax_id:'', email:'', phone:'' });
  }

  return (
    <div className="card" style={{padding:12, marginTop:8}}>
      <div className="row" style={{gap:8, alignItems:'center'}}>
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder={`Buscar ${mode==='provider'?'proveedor':'tercero'}…`}
          style={{flex:'1 1 auto'}}
        />
        {loading ? <small>Buscando…</small> : null}
      </div>

      <div style={{marginTop:8}}>
        {rows.map(r=>(
          <div key={r.id} className="row hover" style={{padding:'8px 4px', alignItems:'center', justifyContent:'space-between'}}>
            <div>
              <div style={{fontWeight:600}}>{r.nick || r.name || 'Sin nombre'}</div>
              <small style={{color:'#6b7280'}}>{r.tax_id || '—'} · {r.kind==='provider'?'Proveedor':'Tercero'}</small>
            </div>
            <Button onClick={()=>onPicked(r)}>Seleccionar</Button>
          </div>
        ))}
        {(!loading && rows.length===0 && q.trim()) ? (
          <>
            <small>No hay resultados.</small>
            <div style={{marginTop:8}}>
              {!inlineNew ? (
                <Button onClick={()=>{ setInlineNew(true); setNewRow(v=>({...v, nick:q})) }}>
                  + Crear nuevo {mode==='provider'?'proveedor':'tercero'}
                </Button>
              ) : (
                <div className="card" style={{marginTop:8}}>
                  <div className="row" style={{gap:8}}>
                    <select value={newRow.kind as any} onChange={e=>setNewRow(v=>({...v, kind:e.target.value as any}))}>
                      <option value="third">Tercero</option>
                      <option value="provider">Proveedor</option>
                    </select>
                    <input placeholder="Nick" value={newRow.nick||''} onChange={e=>setNewRow(v=>({...v, nick:e.target.value}))}/>
                    <input placeholder="Nombre/Empresa" value={newRow.name||''} onChange={e=>setNewRow(v=>({...v, name:e.target.value}))}/>
                    <input placeholder="NIF/CIF" value={newRow.tax_id||''} onChange={e=>setNewRow(v=>({...v, tax_id:e.target.value}))}/>
                    <input placeholder="Email" value={newRow.email||''} onChange={e=>setNewRow(v=>({...v, email:e.target.value}))}/>
                    <input placeholder="Teléfono" value={newRow.phone||''} onChange={e=>setNewRow(v=>({...v, phone:e.target.value}))}/>
                  </div>
                  <div style={{display:'flex', gap:8, marginTop:8}}>
                    <Button onClick={createOrReuse}>Crear y seleccionar</Button>
                    <Button tone="neutral" onClick={reset}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
