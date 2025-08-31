// components/ThirdForm.tsx
import { useState } from 'react';
import Button from './Button';
import { supabase } from '../lib/supabaseClient';

export type ThirdPayload = {
  kind: 'third' | 'provider';
  nick?: string;
  name?: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  logo_url?: string | null;
  // Si estás en contexto artista, pasamos artist_id para vincularlo al crear
  artist_id?: string | null;
};

type Props = {
  initial?: Partial<ThirdPayload>;
  onCreated?: (row: any) => void;
  onCancel?: () => void;
};

function norm(s: string) {
  return (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function ThirdForm({ initial, onCreated, onCancel }: Props) {
  const [form, setForm] = useState<ThirdPayload>({
    kind: (initial?.kind as any) || 'third',
    nick: initial?.nick || '',
    name: initial?.name || '',
    email: initial?.email || '',
    phone: initial?.phone || '',
    tax_id: initial?.tax_id || '',
    logo_url: initial?.logo_url ?? null,
    artist_id: initial?.artist_id || null,
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);

    try {
      // 1) Buscar duplicados "suaves" en cliente (evita el famoso unique_soft)
      const { data: candidates, error: findErr } = await supabase
        .from('third_parties')
        .select('id, kind, nick, name, tax_id, artist_id')
        .eq('kind', form.kind);
      if (findErr) throw findErr;

      const targetNick = norm(form.nick || '');
      const targetName = norm(form.name || '');
      const targetTax  = norm(form.tax_id || '');

      const dup = (candidates || []).find((r:any) => {
        const rn = norm(r.nick || '');
        const rm = norm(r.name || '');
        const rt = norm(r.tax_id || '');
        // Si coincide nick+name+tax_id sin tildes, lo consideramos el mismo
        return (targetNick && rn === targetNick) ||
               (targetName && rm === targetName) ||
               (targetTax  && rt === targetTax);
      });

      if (dup) {
        // Ya existe -> si estamos creando desde un artista y no está vinculado, lo vinculamos
        if (form.artist_id && !dup.artist_id) {
          const { error: upErr } = await supabase
            .from('third_parties')
            .update({ artist_id: form.artist_id, is_active: true })
            .eq('id', dup.id);
          if (upErr) throw upErr;
        }
        setSaving(false);
        onCreated?.(dup);
        return;
      }

      // 2) Insertar
      const { data: inserted, error: insErr } = await supabase
        .from('third_parties')
        .insert({
          kind: form.kind,
          nick: form.nick || null,
          name: form.name || null,
          email: form.email || null,
          phone: form.phone || null,
          tax_id: form.tax_id || null,
          logo_url: form.logo_url || null,
          is_active: true,
          artist_id: form.artist_id || null,
        })
        .select('*')
        .single();

      if (insErr) throw insErr;

      setSaving(false);
      onCreated?.(inserted);
    } catch (e: any) {
      setSaving(false);
      setErr(e.message || 'No se pudo guardar');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="module" style={{maxWidth: 640}}>
      <h2 style={{marginTop:0}}>Nuevo {form.kind === 'third' ? 'tercero' : 'proveedor'}</h2>

      {err && <div style={{color:'#d42842', marginBottom:12}}>Error: {err}</div>}

      <div className="row">
        <div style={{flex:'0 0 200px'}}>
          <label>Tipo</label>
          <select
            value={form.kind}
            onChange={(e)=> setForm(f=>({ ...f, kind: e.target.value as any }))}
          >
            <option value="third">Tercero</option>
            <option value="provider">Proveedor</option>
          </select>
        </div>
        <div style={{flex:'1 1 240px'}}>
          <label>Nick</label>
          <input
            value={form.nick}
            onChange={(e)=> setForm(f=>({ ...f, nick: e.target.value }))}
          />
        </div>
        <div style={{flex:'1 1 240px'}}>
          <label>Nombre/Empresa</label>
          <input
            value={form.name || ''}
            onChange={(e)=> setForm(f=>({ ...f, name: e.target.value }))}
          />
        </div>
      </div>

      <div className="row">
        <div style={{flex:'1 1 240px'}}>
          <label>Email</label>
          <input
            value={form.email || ''}
            onChange={(e)=> setForm(f=>({ ...f, email: e.target.value }))}
          />
        </div>
        <div style={{flex:'0 0 180px'}}>
          <label>Teléfono</label>
          <input
            value={form.phone || ''}
            onChange={(e)=> setForm(f=>({ ...f, phone: e.target.value }))}
          />
        </div>
        <div style={{flex:'0 0 200px'}}>
          <label>NIF/CIF</label>
          <input
            value={form.tax_id || ''}
            onChange={(e)=> setForm(f=>({ ...f, tax_id: e.target.value }))}
          />
        </div>
      </div>

      <div style={{display:'flex', gap:8, marginTop:12}}>
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button type="button" tone="neutral" onClick={onCancel} disabled={saving}>Cancelar</Button>
      </div>
    </form>
  );
}
