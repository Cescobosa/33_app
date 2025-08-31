// pages/artists/[id]/edit.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../../components/Layout';
import Button from '../../../components/Button';
import { supabase } from '../../../lib/supabaseClient';
import ContractsBlock from '../../../components/ContractsBlock';
import ArtistThirdsBlock from '../../../components/ArtistThirdsBlock'; // ⬅️ nuevo (sustituye SmartPartySelect + listado manual)

type Artist = {
  id: string;
  stage_name: string;
  contract_type: 'General'|'Booking';
  is_group: boolean;
  photo_url: string|null;
  email: string|null;
  phone: string|null;
  tax_type: 'particular'|'empresa'|null;
  tax_name: string|null;
  tax_id: string|null;
  tax_address: string|null;
  iban: string|null;
};

type Member = {
  id: string;
  artist_id: string;
  full_name: string;
  dni: string | null;
  birth_date: string | null;
  email: string | null;
  phone: string | null;
  left_at: string | null;
};

export default function EditArtist() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [a, setA] = useState<Artist | null>(null);

  // Miembros
  const [members, setMembers] = useState<Member[]>([]);
  const [initialIds, setInitialIds] = useState<string[]>([]);

  async function load() {
    if (!id) return;

    // Artista
    const { data: artist, error: aErr } = await supabase.from('artists').select('*').eq('id', id).single();
    if (aErr) { alert(aErr.message); return; }
    setA(artist as any);

    // Miembros activos
    const { data: m, error: mErr } = await supabase.from('artist_members').select('*')
      .eq('artist_id', id)
      .is('left_at', null)
      .order('created_at', { ascending:true });
    if (mErr) { alert(mErr.message); return; }
    const ms = (m||[]) as Member[];
    setMembers(ms);
    setInitialIds(ms.map(x=>x.id));
  }
  useEffect(()=>{ load(); }, [id]);

  function addMember() {
    setMembers(m=>[...m, {
      id: `tmp_${Date.now()}`,
      artist_id: id!,
      full_name: '',
      dni: null, birth_date: null, email: null, phone: null, left_at: null
    }]);
  }
  function rmMember(idx:number) {
    setMembers(m => m.filter((_,i)=>i!==idx));
  }
  function upMember(idx:number, key:keyof Member, val:any) {
    const copy = [...members];
    (copy[idx] as any)[key] = val;
    setMembers(copy);
  }

  async function save() {
    if (!a) return;
    try {
      // 1) Guarda artista
      const { error: aErr } = await supabase
        .from('artists')
        .update({
          stage_name: a.stage_name,
          contract_type: a.contract_type,
          is_group: a.is_group,
          email: a.email,
          phone: a.phone,
          tax_type: a.tax_type,
          tax_name: a.tax_name,
          tax_id: a.tax_id,
          tax_address: a.tax_address,
          iban: a.iban
        })
        .eq('id', a.id);
      if (aErr) throw aErr;

      // 2) Miembros
      const currentIds = members.filter(m=>!m.id.startsWith('tmp_')).map(m=>m.id);
      const removed = initialIds.filter(oldId => !currentIds.includes(oldId));
      for (const rid of removed) {
        const r = await supabase
          .from('artist_members')
          .update({ left_at: new Date().toISOString() })
          .eq('id', rid);
        if (r.error) throw r.error;
      }
      for (const m of members) {
        if (m.id.startsWith('tmp_')) {
          const ins = await supabase.from('artist_members').insert({
            artist_id: a.id,
            full_name: m.full_name || '',
            dni: m.dni || null,
            birth_date: m.birth_date || null,
            email: m.email || null,
            phone: m.phone || null,
            left_at: null
          });
          if (ins.error) throw ins.error;
        } else {
          const up = await supabase.from('artist_members').update({
            full_name: m.full_name || '',
            dni: m.dni || null,
            birth_date: m.birth_date || null,
            email: m.email || null,
            phone: m.phone || null
          }).eq('id', m.id);
          if (up.error) throw up.error;
        }
      }

      alert('Cambios guardados.');
      await load();
    } catch (e:any) {
      alert(e.message || 'No se pudo guardar');
    }
  }

  if (!a) return <Layout><div className="module">Cargando…</div></Layout>;

  return (
    <Layout>
      <div className="module" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <h1 style={{margin:0}}>Editar: {a.stage_name}</h1>
        <div style={{display:'flex', gap:8}}>
          <Button onClick={save}>Guardar cambios</Button>
          <Button as="a" tone="neutral" href={`/artists/${a.id}`}>Volver</Button>
        </div>
      </div>

      {/* Datos básicos */}
      <div className="module">
        <h2>Datos básicos</h2>
        <div className="row">
          <div style={{flex:'1 1 280px'}}><label>Nombre artístico</label>
            <input value={a.stage_name} onChange={e=>setA({...a, stage_name:e.target.value})}/>
          </div>
          <div style={{flex:'0 0 220px'}}><label>Tipo de contrato</label>
            <select value={a.contract_type} onChange={e=>setA({...a, contract_type:e.target.value as any})}>
              <option value="General">General</option>
              <option value="Booking">Booking</option>
            </select>
          </div>
          <div style={{flex:'0 0 160px'}}><label>¿Es grupo?</label>
            <select value={a.is_group?'sí':'no'} onChange={e=>setA({...a, is_group:e.target.value==='sí'})}>
              <option>no</option><option>sí</option>
            </select>
          </div>
        </div>
      </div>

      {/* Miembros (con baja lógica) */}
      {a.is_group && (
        <div className="module">
          <h2>Miembros</h2>
          <Button onClick={addMember}>+ Añadir miembro</Button>
          {members.map((m, i)=>(
            <div key={m.id} className="card" style={{marginTop:8}}>
              <div className="row">
                <div style={{flex:'1 1 300px'}}><label>Nombre completo</label>
                  <input value={m.full_name} onChange={e=>upMember(i,'full_name', e.target.value)} />
                </div>
                <div style={{flex:'0 0 180px'}}><label>DNI</label>
                  <input value={m.dni||''} onChange={e=>upMember(i,'dni', e.target.value)} />
                </div>
                <div style={{flex:'0 0 200px'}}><label>Fecha nacimiento</label>
                  <input type="date" value={m.birth_date||''} onChange={e=>upMember(i,'birth_date', e.target.value)} />
                </div>
                <div style={{display:'flex', alignItems:'flex-end'}}>
                  <Button tone="danger" onClick={()=>rmMember(i)}>Dar de baja</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 🔹 Terceros vinculados: módulo unificado (buscador + crear en modal + lista con Editar/Desvincular) */}
      <ArtistThirdsBlock artistId={a.id} />

      {/* Contratos del artista */}
      <div className="module">
        <h2>Contratos</h2>
        <ContractsBlock kind="artist" ownerId={a.id} />
      </div>
    </Layout>
  );
}
