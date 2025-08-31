// components/ArtistThirdsBlock.tsx
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from './Button';
import { supabase } from '../lib/supabaseClient';
import ThirdPartyPicker from './ThirdPartyPicker';

type ThirdRow = {
  id: string;
  artist_id: string | null;
  kind: 'third' | 'provider';
  nick: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean | null;
};

export default function ArtistThirdsBlock({ artistId }:{ artistId: string }) {
  const [rows, setRows] = useState<ThirdRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('third_parties')
      .select('id, artist_id, kind, nick, name, email, phone, logo_url, is_active')
      .eq('artist_id', artistId)
      .eq('kind', 'third')
      .order('nick', { ascending: true });
    setRows((data || []) as any);
    setLoading(false);
  }

  useEffect(()=>{ load(); }, [artistId]);

  async function unlink(id: string) {
    if (!confirm('¿Desvincular este tercero del artista?')) return;
    const { error } = await supabase
      .from('third_parties')
      .update({
        artist_id: null,
        unlinked: true,
        unlinked_at: new Date().toISOString(),
        unlinked_from_artist_id: artistId
      })
      .eq('id', id);
    if (error) { alert(error.message); return; }
    load();
  }

  return (
    <div className="module">
      <h2 style={{marginTop:0}}>Terceros vinculados</h2>

      <ThirdPartyPicker
        artistId={artistId}
        onLinked={() => load()}
      />

      {loading && <div>Cargando…</div>}
      {!loading && rows.length === 0 && <small>No hay terceros vinculados.</small>}

      {rows.map(t => (
        <div key={t.id} className="card" style={{marginTop:10}}>
          <div className="row" style={{ alignItems:'center' }}>
            <div style={{ width:56, height:56, borderRadius:12, overflow:'hidden', background:'#f3f4f6' }}>
              {t.logo_url && <img src={t.logo_url} alt={t.nick || t.name || 'tercero'} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>}
            </div>
            <div style={{ flex:'1 1 auto' }}>
              <Link href={`/partners/thirds/${t.id}`} style={{ fontWeight: 600 }}>
                {t.nick || t.name || 'Sin nombre'}
              </Link>
              <div style={{ color:'#6b7280', fontSize:12 }}>
                {t.email || '—'} · {t.phone || '—'}
              </div>
            </div>
            <div style={{display:'flex', gap:8}}>
              <Button as="a" href={`/partners/thirds/${t.id}/edit`} tone="neutral">Editar</Button>
              <Button tone="danger" onClick={()=> unlink(t.id)}>Desvincular</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
