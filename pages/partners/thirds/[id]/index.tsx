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
  kind: 'third'|'provider';
  nick: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  tax_type: 'particular'|'empresa'|null;
  tax_name: string | null;
  tax_id: string | null;
  tax_address: string | null;
  iban: string | null;
  artist_id: string | null; // en este modelo, un tercero puede venir vinculado 1:1 por fila
};

type ArtistMini = { id: string; stage_name: string; photo_url: string|null };

export default function ThirdShow() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [third, setThird] = useState<Third|null>(null);
  const [artist, setArtist] = useState<ArtistMini | null>(null);

  async function load() {
    if (!id) return;
    const { data: t, error } = await supabase
      .from('third_parties')
      .select('*')
      .eq('id', id)
      .single();
    if (error) { alert(error.message); return; }
    setThird(t as any);

    // si está vinculado a un artista (modelo 1:1 por fila), lo traemos
    if ((t as any).artist_id) {
      const { data: a } = await supabase
        .from('artists')
        .select('id, stage_name, photo_url')
        .eq('id', (t as any).artist_id)
        .single();
      if (a) setArtist(a as any);
    }
  }

  useEffect(()=>{ load(); }, [id]);

  if (!third) return <Layout><div className="module">Cargando…</div></Layout>;

  return (
    <Layout>
      {/* Cabecera: foto + nick/nombre */}
      <div className="module" style={{display:'flex', alignItems:'center', gap:16}}>
        <div style={{width:96, height:96, borderRadius:16, overflow:'hidden', background:'#f3f4f6'}}>
          {third.logo_url ? <img src={third.logo_url} alt={third.nick || third.name || 'tercero'} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : null}
        </div>
        <div>
          <h1 style={{margin:0}}>{third.nick || third.name || 'Sin nombre'}</h1>
          <div style={{color:'#6b7280', marginTop:4}}>
            {third.kind === 'provider' ? 'Proveedor' : 'Tercero'}
          </div>
        </div>
      </div>

      {/* Vinculaciones (artista) */}
      <div className="module">
        <h2>Vinculaciones</h2>
        {!artist ? (
          <small>No hay artista vinculado.</small>
        ) : (
          <div className="card" style={{display:'flex', alignItems:'center', gap:12}}>
            <div style={{width:56, height:56, borderRadius:12, overflow:'hidden', background:'#f3f4f6'}}>
              {artist.photo_url ? <img src={artist.photo_url} alt={artist.stage_name} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : null}
            </div>
            <Link href={`/artists/${artist.id}`} style={{fontWeight:600}}>
              {artist.stage_name}
            </Link>
          </div>
        )}
      </div>

      {/* Datos fiscales */}
      <div className="module">
        <h2>Datos fiscales</h2>
        <div className="row">
          {third.tax_type ? <div style={{flex:'0 0 160px'}}><strong>Tipo</strong><div>{third.tax_type}</div></div> : null}
          {third.tax_name ? <div style={{flex:'1 1 260px'}}><strong>Nombre fiscal</strong><div>{third.tax_name}</div></div> : null}
          {third.tax_id ? <div style={{flex:'0 0 200px'}}><strong>NIF/CIF</strong><div>{third.tax_id}</div></div> : null}
          {third.tax_address ? <div style={{flex:'1 1 320px'}}><strong>Domicilio fiscal</strong><div>{third.tax_address}</div></div> : null}
          {third.iban ? <div style={{flex:'1 1 280px'}}><strong>IBAN</strong><div>{third.iban}</div></div> : null}
        </div>
      </div>

      {/* Contratos del tercero (si aplica) */}
      <div className="module">
        <h2>Contratos</h2>
        <ContractsBlock kind="third" ownerId={third.id} />
      </div>
    </Layout>
  );
}
