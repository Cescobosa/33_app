// pages/partners/thirds/[id]/index.tsx
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../../../../components/Layout';
import Button from '../../../../components/Button';
import { supabase } from '../../../../lib/supabaseClient';
import ContractsBlock from '../../../../components/ContractsBlock';

type Third = {
  id: string;
  artist_id: string | null;
  nick: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean | null;
  kind: 'third'|'provider';
  unlinked: boolean | null;
  unlinked_at: string | null;
  unlinked_from_artist_id: string | null;
};

export default function ThirdShow() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [third, setThird] = useState<Third | null>(null);
  const [fromArtistName, setFromArtistName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true); setErr(null);
    try {
      const { data: t, error } = await supabase.from('third_parties').select('*').eq('id', id).single();
      if (error) throw error;
      setThird(t as any);

      // si está marcado como desvinculado, traemos el nombre del artista
      if (t?.unlinked && t.unlinked_from_artist_id) {
        const { data: a } = await supabase.from('artists').select('stage_name').eq('id', t.unlinked_from_artist_id).single();
        setFromArtistName(a?.stage_name || null);
      } else {
        setFromArtistName(null);
      }
    } catch (e:any) {
      setErr(e.message || 'Error cargando tercero');
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, [id]);

  if (loading) return <Layout><div className="module">Cargando…</div></Layout>;
  if (err || !third) return <Layout><div className="module" style={{color:'#d42842'}}>Error: {err || 'No encontrado'}</div></Layout>;

  return (
    <Layout>
      {/* Cabecera */}
      <div className="module" style={{display:'flex', alignItems:'center', gap:16}}>
        <div style={{ width: 80, height: 80, borderRadius: 16, overflow:'hidden', background:'#f3f4f6' }}>
          {third.logo_url && <img src={third.logo_url} alt={third.nick || third.name || 'logo'} style={{width:'100%', height:'100%', objectFit:'cover'}}/>}
        </div>
        <div>
          <h1 style={{margin:0}}>{third.nick || third.name || 'Sin nombre'}</h1>
          <div style={{color:'#6b7280', fontSize:12}}>{third.kind === 'provider' ? 'Proveedor' : 'Tercero'}</div>
        </div>
      </div>

      {/* Aviso rojo si está desvinculado */}
      {third.unlinked ? (
        <div className="module" style={{border:'1px solid #ef4444', background:'#fff1f2'}}>
          <div style={{color:'#b91c1c', fontWeight:700, marginBottom:6}}>
            Desvinculado{fromArtistName ? <> de <Link href={`/artists`}>{fromArtistName}</Link></> : ''}{third.unlinked_at ? <> desde {new Date(third.unlinked_at).toLocaleDateString()}</> : null}
          </div>
          <small>Se mantiene la ficha para conservar el histórico.</small>
        </div>
      ) : null}

      {/* Datos de contacto básicos */}
      <div className="module">
        <h2>Contacto</h2>
        <div className="row">
          <div style={{flex:'1 1 260px'}}><strong>Nombre</strong><div>{third.name || '—'}</div></div>
          <div style={{flex:'0 0 220px'}}><strong>Email</strong><div>{third.email || '—'}</div></div>
          <div style={{flex:'0 0 160px'}}><strong>Teléfono</strong><div>{third.phone || '—'}</div></div>
        </div>
      </div>

      {/* Contratos del tercero */}
      <div className="module">
        <h2>Contratos</h2>
        <ContractsBlock kind="third" ownerId={third.id} />
      </div>
    </Layout>
  );
}
