// app/player/PlayerClient.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

type Track = {
  id: string;
  name: string;
  url: string;
  type: string;
  active: boolean;
  playlist: string;
};

export default function PlayerClient() {
  const searchParams = useSearchParams();
  const urlPlaylist = searchParams.get('pl');

  const [playlist, setPlaylist] = useState<string>('loja');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Carrega playlist oficial + músicas
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1) descobrir qual playlist usar
        let activePlaylist = urlPlaylist || '';

        if (!activePlaylist) {
          const { data: config, error: configError } = await supabase
            .from('store_config')
            .select('current_playlist')
            .eq('id', 1)
            .single();

          if (configError) {
            console.error('Erro ao buscar config:', configError);
          }

          activePlaylist = config?.current_playlist ?? 'loja';
        }

        setPlaylist(activePlaylist);

        // 2) buscar músicas dessa playlist
        const { data, error } = await supabase
          .from('tracks')
          .select('*')
          .eq('active', true)
          .eq('playlist', activePlaylist)
          .order('name', { ascending: true });

        if (error) {
          throw error;
        }

        setTracks(data || []);
        setCurrentIndex(0);
      } catch (err) {
        console.error(err);
        setError('Não foi possível carregar as músicas.');
        setTracks([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [urlPlaylist]);

  // Controla play/pause do áudio quando mudar faixa ou estado
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentIndex]);

  const currentTrack = tracks[currentIndex];

  function handleEnded() {
    if (!tracks.length) return;
    setCurrentIndex((prev) => (prev + 1) % tracks.length);
  }

  function handlePlayPause() {
    setIsPlaying((prev) => !prev);
  }

  function handleNext() {
    if (!tracks.length) return;
    setCurrentIndex((prev) => (prev + 1) % tracks.length);
    setIsPlaying(true);
  }

  function handlePrev() {
    if (!tracks.length) return;
    setCurrentIndex((prev) => (prev - 1 < 0 ? tracks.length - 1 : prev - 1));
    setIsPlaying(true);
  }

  // —— TELAS DE ESTADO —— //

  if (loading) {
    return (
      <main className="radio-bg">
        <div className="radio-card">
          <p className="radio-chip">Carregando player…</p>
          <h1 className="radio-title">Rádio Fórmula Foz</h1>
          <p className="radio-sub">Preparando a trilha sonora da loja.</p>
        </div>
      </main>
    );
  }

  if (error || !tracks.length) {
    return (
      <main className="radio-bg">
        <div className="radio-card">
          <p className="radio-chip">Player</p>
          <h1 className="radio-title">Rádio Fórmula Foz</h1>

          <div className="radio-error">
            <span>😕</span>
            <div>
              <p>
                {error ||
                  'Nenhuma música ativa encontrada para esta playlist.'}
              </p>
              <small>
                Playlist atual: <strong>{playlist}</strong>
              </small>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // —— UI PRINCIPAL DO PLAYER —— //

  return (
    <main className="radio-bg">
      <div className="radio-card">
        <div className="radio-header">
          <div>
            <p className="radio-chip">Player da loja</p>
            <h1 className="radio-title">Rádio Fórmula Foz</h1>
            <p className="radio-sub">
              Ambiente pronto para receber os clientes.
            </p>
          </div>

          <div className="radio-pill">
            Playlist:&nbsp;<strong>{playlist}</strong>
          </div>
        </div>

        <div className="radio-body">
          <div className="radio-cover">
            <div className="radio-cover-inner">
              <span className="radio-cover-icon">♫</span>
            </div>
          </div>

          <div className="radio-track-info">
            <p className="radio-now-playing">Reproduzindo agora</p>
            <p className="radio-track-name">{currentTrack?.name}</p>
            <p className="radio-track-meta">
              Faixa {currentIndex + 1} de {tracks.length}
            </p>
          </div>

          <div className="radio-controls">
            <button
              type="button"
              className="radio-btn ghost"
              onClick={handlePrev}
            >
              ‹‹
            </button>

            <button
              type="button"
              className="radio-btn primary"
              onClick={handlePlayPause}
            >
              {isPlaying ? 'Pausar' : 'Tocar'}
            </button>

            <button
              type="button"
              className="radio-btn ghost"
              onClick={handleNext}
            >
              ››
            </button>
          </div>

          <audio
            ref={audioRef}
            src={currentTrack.url}
            onEnded={handleEnded}
          />

          <div className="radio-footer">
            <div className="radio-dot" />
            <span>
              Reprodução contínua enquanto o navegador estiver aberto.
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
