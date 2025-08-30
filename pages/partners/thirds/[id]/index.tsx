// pages/partners/thirds/[id]/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabaseClient';
import Layout from '../../../../components/Layout';
import Button from '../../../../components/Button';
import ContractsBlock from '../../../../components/ContractsBlock';

type Tp = {
  id: string;
  kind: 'third'|'provider';
  nick: string|null;
  name: string|null;
  logo_url: string|null;
  is_deleted?: boolean|null;
};

export default function ThirdShow() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [row, setRow] = useState<Tp|null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string|null>(null);

  async function load() {
    if (!id) return;
    setLoading(true); setErr(null);
    const { data, error } = await supabase
      .from('third_parties')
      .select('id, kind, nick, name, logo_url, is_deleted')
      .eq('id', id).single();
    if (error) setErr(error.message);
    setRow(data as any);
    setLoading(false);
  }
  useEffect(()=>{ load(); }, [id]);

  async function onDelete() {
    if (!row) return;
    const confirm = prompt('Para eliminar este registro, escribe: ELIMINAR');
    if (confirm !== 'ELIMINAR') return;
    const { error } = await supabase
      .from('third_parties')
      .update({ is_deleted: true, is_active: false })
      .eq('id', row.id);
    if (error) return alert(error.message);
    router.push('/partners/thirds'); // vuelve al listado (ajústalo a tu ruta)
  }

  if (loading) return <Layout><div className="module">Cargando…</div></Layout>;
  if (err || !row)  return <Layout><div className="module" style={{color:'#d42842'}}>Error: {err || 'No encontrado'}</div></Layout>;

  return (
    <Layout>
      <div className="module" style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:16}}>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          <div style={{width:96, height:96, borderRadius:16, background:'#f3f4f6', overflow:'hidden'}}>
            {row.logo_url ? <img src={row.logo_url} alt={row.nick||row.name||''} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : null}
          </div>
          <div>
            <h1 style={{margin:0}}>{row.nick || row.name || 'Sin nombre'}</h1>
            <small style={{color:'#6b7280'}}>{row.kind==='provider'?'Proveedor':'Tercero'}</small>
          </div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <Link href="/partners/thirds"><Button tone="neutral">Volver</Button></Link>
          <Button tone="danger" onClick={onDelete}>Borrar</Button>
        </div>
      </div>

      <div className="module">
        <ContractsBlock kind="third" ownerId={row.id}/>
      </div>
    </Layout>
  );
}
