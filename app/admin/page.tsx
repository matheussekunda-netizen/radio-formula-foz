'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

type Track = {
  id: string;
  name: string;
  url: string;
  type: string;
  active: boolean;
  playlist: string;
};

export default function AdminPage() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentPlaylist, setCurrentPlaylist] = useState<string>('loja');
  const [availablePlaylists, setAvailablePlaylists] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Carrega músicas + config da loja
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1) Tracks
        const { data: tracksData, error: tracksError } = await supabase
          .from('tracks')
          .select('*')
          .order('name', { ascending: true });

        if (tracksError) {
          setError('Erro ao carregar músicas.');
          console.error(tracksError);
          return;
        }

        setTracks(tracksData || []);

        // monta lista de playlists distintas
        const playlists = Array.from(
          new Set(
            (tracksData || [])
              .map((t) => t.playlist)
              .filter((p): p is string => !!p)
          )
        );
        if (!playlists.includes('loja')) playlists.push('loja');
        setAvailablePlaylists(playlists);

        // 2) Config loja
        const { data: config, error: configError } = await supabase
          .from('store_config')
          .select('current_playlist')
          .eq('id', 1)
          .single();

        if (configError) {
          console.error(configError);
        }

        setCurrentPlaylist(config?.current_playlist ?? 'loja');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  function toggleTrackActive(id: string) {
    setTracks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, active: !t.active } : t
      )
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // 1) Salvar ativo/inativo das músicas
      const updates = tracks.map((t) =>
        supabase
          .from('tracks')
          .update({ active: t.active, playlist: t.playlist })
          .eq('id', t.id)
      );

      const results = await Promise.all(updates);
      const hasError = results.some((r) => r.error);

      if (hasError) {
        console.error(results);
        setError('Erro ao salvar músicas.');
        return;
      }

      // 2) Salvar playlist atual da loja
      const { error: configError } = await supabase
        .from('store_config')
        .upsert({ id: 1, current_playlist: currentPlaylist });

      if (configError) {
        console.error(configError);
        setError('Erro ao salvar playlist atual da loja.');
        return;
      }

      setSuccess('Alterações salvas com sucesso!');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: '#050505',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <p>Carregando painel...</p>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#050505',
        color: '#fff',
        padding: 32,
      }}
    >
      <h1 style={{ fontSize: 32, textAlign: 'center', marginBottom: 8 }}>
        Painel Rádio Fórmula Foz
      </h1>
      <p style={{ textAlign: 'center', opacity: 0.8, marginBottom: 24 }}>
        Ative/desative músicas e escolha a playlist oficial da loja.
      </p>

      {/* Status */}
      {error && (
        <p style={{ color: '#ff6b6b', textAlign: 'center', marginBottom: 16 }}>
          {error}
        </p>
      )}
      {success && (
        <p style={{ color: '#4ade80', textAlign: 'center', marginBottom: 16 }}>
          {success}
        </p>
      )}

      {/* Playlist atual da loja */}
      <section
        style={{
          maxWidth: 720,
          margin: '0 auto 32px',
          padding: 16,
          backgroundColor: '#111',
          borderRadius: 8,
        }}
      >
        <h2 style={{ marginBottom: 8 }}>Playlist atual da loja</h2>
        <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
          O player da loja (<code>/player</code>) sempre vai tocar a playlist
          selecionada aqui.
        </p>

        <select
          value={currentPlaylist}
          onChange={(e) => setCurrentPlaylist(e.target.value)}
          style={{
            padding: 8,
            borderRadius: 4,
            border: '1px solid #333',
            backgroundColor: '#000',
            color: '#fff',
            minWidth: 200,
          }}
        >
          {availablePlaylists.map((pl) => (
            <option key={pl} value={pl}>
              {pl}
            </option>
          ))}
        </select>
      </section>

      {/* Tabela de músicas */}
      <section
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: 16,
          backgroundColor: '#111',
          borderRadius: 8,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 8 }}>Ativa?</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Nome</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Playlist</th>
              <th style={{ textAlign: 'left', padding: 8 }}>Tipo</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t) => (
              <tr key={t.id}>
                <td style={{ padding: 8 }}>
                  <input
                    type="checkbox"
                    checked={t.active}
                    onChange={() => toggleTrackActive(t.id)}
                  />
                </td>
                <td style={{ padding: 8 }}>{t.name}</td>
                <td style={{ padding: 8 }}>{t.playlist}</td>
                <td style={{ padding: 8 }}>{t.type}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            backgroundColor: '#f97316',
            color: '#000',
            border: 'none',
            padding: '10px 24px',
            borderRadius: 999,
            fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </main>
  );
}
