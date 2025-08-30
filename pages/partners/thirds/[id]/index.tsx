// pages/partners/thirds/[id]/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../../../lib/supabaseClient';
import Layout from '../../../../components/Layout';
import Button from '../../../../components/Button';
import ContractsBlock from '../../../../components/ContractsBlock';

type Third = {
  id: string;
  artist_id: string | null;
  kind: 'third'|'provider';
  nick: string | null;
  name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

export default function ThirdShow() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [t, setT] = useState<Third | null>(null);

  async function load() {
    if (!id) return;
    const { data } = await supabase.from('third_parties').select('*').eq('id', id).single();
    setT(data as any);
  }
  useEffect(()=>{ load(); }, [id]);

  async function hardDelete() {
    if (!t) return;
    const sure = prompt('Escribe ELIMINAR para borrar definitivamente este tercero/proveedor del sistema');
    if (sure !== 'ELIMINAR') return;
    try {
      // Borra contratos y economics del tercero
      const a = await supabase.from('third_party_contracts').delete().eq('third_party_id', t.id);
      if (a.error) throw a.error;
      const b = await supabase.from('third_party_economics').delete().eq('third_party_id', t.id);
      if (b.error) throw b.error;
      const c = await supabase.from('third_party_contacts').delete().eq('third_party_id', t.id);
      if (c.error) throw c.error;

      // Limpia datos (para que nunca aparezca en listados) y marca inactivo
      const u = await supabase.from('third_parties').update({
        artist_id: null,
        nick: `[ELIMINADO] ${t.id.slice(0,6)}`,
        name: null,
        tax_id: null,
        email: null,
        phone: null,
        logo_url: null,
        is_active: false
      }).eq('id', t.id);
      if (u.error) throw u.error;

      router.push('/partners/thirds'); // vuelve al listado
    } catch (e:any) {
      alert(e.message || 'No se pudo borrar');
    }
  }

  if (!t) return <Layout><div className="module">Cargando…</div></Layout>;

  return (
    <Layout>
      <div className="module" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div>
          <h1 style={{margin:0}}>{t.nick || t.name || 'Sin nombre'}</h1>
          <div style={{color:'#6b7280'}}>{t.kind === 'third' ? 'Tercero' : 'Proveedor'}</div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <Button as="a" href={`/partners/${t.kind==='third'?'thirds':'providers'}/${t.id}/edit`} tone="neutral">Editar</Button>
          <Button tone="danger" onClick={hardDelete}>Borrar</Button>
        </div>
      </div>

      <div className="module">
        <h2>Contratos</h2>
        <ContractsBlock kind="third" ownerId={t.id} />
      </div>
    </Layout>
  );
}
