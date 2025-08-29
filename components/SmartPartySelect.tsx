import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Button from './Button';

type Kind = 'third'|'provider';
type Party = {
  id: string;
  kind: Kind;
  nick: string|null;
  name: string|null;
  email: string|null;
  phone: string|null;
  logo_url: string|null;
  tax_id: string|null;
  tax_name: string|null;
};

type Props = {
  kind: Kind;                             // 'third' o 'provider'
  onSelect: (p: Party) => void;           // devolvemos el existente o el recién creado
};

export default function SmartPartySelect({ kind, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Party[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    nick:'', name:'', email:'', phone:'', tax_id:'', tax_name:'', tax_type:'particular' as 'particular'|'empresa'
  });
  const [err, setErr] = useState<string|null>(null);

  // Buscar existentes por cualquier campo principal
  async function search() {
    let req = supabase.from('third_parties')
      .select('id,kind,nick,name,email,phone,logo_url,tax_id,tax_name')
      .eq('kind', kind)
      .order('name', { ascending: true });

    if (q.trim()) {
      const like = `%${q.trim()}%`;
      req = req.or([
        `nick.ilike.${like}`,
        `name.ilike.${like}`,
        `email.ilike.${like}`,
        `phone.ilike.${like}`,
        `tax_id.ilike.${like}`,
        `tax_name.ilike.${like}`
      ].join(','));
    }

    const { data } = await req;
    setRows(data || []);
  }

  useEffect(()=>{ search(); }, [q, kind]);

  async function create() {
    setErr(null);
    try {
      // anti-duplicados básico (nick, name o tax_id)
      const dupLike = `%${(form.nick || form.name || form.tax_id).trim()}%`;
      const { data: dup } = await supabase
        .from('third_parties')
        .select('id,nick,name,tax_id')
        .eq('kind', kind)
        .or(`nick.ilike.${dupLike},name.ilike.${dupLike},tax_id.ilike.${dupLike}`)
        .limit(1);
      if (dup && dup.length) {
        setErr(`Ya existe uno parecido: ${dup[0].nick || dup[0].name || dup[0].tax_id}`);
        return;
      }

      const { data, error } = await supabase.from('third_parties').insert({
        kind,
        nick: form.nick || null,
        name: form.name || null,
        email: form.email || null,
        phone: form.phone || null,
        tax_id: form.tax_id || null,
        tax_name: form.tax_name || (form.name || null),
        tax_type: form.tax_type
      }).select('id,kind,nick,name,email,phone,logo_url,tax_id,tax_name').single();
      if (error) throw error;

      onSelect(data as Party);
      setCreating(false);
      setForm({nick:'',name:'',email:'',phone:'',tax_id:'',tax_name:'',tax_type:'particular'});
      setQ('');
      await search();
    } catch (e:any) {
      setErr(e.message || 'Error creando');
    }
  }

  return (
    <div>
      {!creating ? (
        <>
          <div className="row" style={{alignItems:'center', gap:8}}>
            <div style={{flex:'1 1 420px'}}>
              <input placeholder={`Buscar ${kind==='third'?'tercero':'proveedor'} por cualquier dato…`} value={q} onChange={e=>setQ(e.target.value)} />
            </div>
            <Button onClick={()=>setCreating(true)}>+ Crear nuevo</Button>
          </div>
          <div style={{marginTop:8}}>
            {rows.slice(0,8).map(p=>(
              <div key={p.id} className="list-item" style={{display:'flex', justifyContent:'space-between', padding:'6px 8px', borderBottom:'1px solid #eee', cursor:'pointer'}}
                   onClick={()=>onSelect(p)}>
                <div>
                  <strong>{p.nick || p.name || 'Sin nombre'}</strong>
                  <div style={{fontSize:12, color:'#6b7280'}}>{[p.email, p.phone, p.tax_id].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <div style={{fontSize:12, color:'#6b7280'}}>Seleccionar</div>
              </div>
            ))}
            {rows.length===0 ? <small>No hay resultados.</small> : null}
          </div>
        </>
      ) : (
        <div className="card">
          <div className="row">
            <div style={{flex:'0 0 180px'}}><label>Tipo</label>
              <select value={form.tax_type} onChange={e=>setForm({...form, tax_type: e.target.value as any})}>
                <option value="particular">Particular</option>
                <option value="empresa">Empresa</option>
              </select>
            </div>
            <div style={{flex:'1 1 220px'}}><label>Nick</label><input value={form.nick} onChange={e=>setForm({...form, nick:e.target.value})}/></div>
            <div style={{flex:'1 1 260px'}}><label>Nombre / Compañía</label><input value={form.name} onChange={e=>setForm({...form, name:e.target.value})}/></div>
            <div style={{flex:'0 0 200px'}}><label>NIF/CIF</label><input value={form.tax_id} onChange={e=>setForm({...form, tax_id:e.target.value})}/></div>
            <div style={{flex:'1 1 260px'}}><label>Nombre fiscal</label><input value={form.tax_name} onChange={e=>setForm({...form, tax_name:e.target.value})}/></div>
            <div style={{flex:'0 0 220px'}}><label>Email</label><input value={form.email} onChange={e=>setForm({...form, email:e.target.value})}/></div>
            <div style={{flex:'0 0 160px'}}><label>Teléfono</label><input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})}/></div>
          </div>
          {err ? <div style={{color:'#b91c1c'}}>{err}</div> : null}
          <div style={{display:'flex', gap:8}}>
            <Button onClick={create}>Guardar</Button>
            <Button tone="neutral" onClick={()=>{ setCreating(false); setErr(null); }}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
