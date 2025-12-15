// app/player/PlayerClient.tsx
'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

type Track = {
  id: string;
  name: string;
  url: string;
  type: string;
  active: boolean;
  playlist: string;
  sort_order?: number | null; // nova coluna opcional
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

  // 🔊 Volume (1 = 100%)
  const [volume, setVolume] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // evita chamar handleEnded várias vezes no finzinho da música
  const preEndCalledRef = useRef(false);

  // ===========================
  // 1) Carrega playlist + músicas
  // ===========================
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        // 1) Descobrir qual playlist usar
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

        // 2) Buscar músicas dessa playlist
        const { data, error } = await supabase
          .from('tracks')
          .select('*')
          .eq('active', true)
          .eq('playlist', activePlaylist)
          // primeiro ordena por sort_order (se tiver),
          // depois por created_at pra manter consistência
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (error) throw error;

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

  // ===========================
  // 2) Controle de play / pause
  // ===========================
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {
        // se der erro pra tocar (autoplay bloqueado, etc)
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }

    // sempre que trocar de faixa / estado, libera o pré-fim novamente
    preEndCalledRef.current = false;
  }, [isPlaying, currentIndex]);

  // ===========================
  // 3) Aplica volume no <audio>
  // ===========================
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  const currentTrack = tracks[currentIndex];

  // ===========================
  // 4) Navegação entre faixas
  // ===========================
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
    setCurrentIndex((prev) =>
      prev - 1 < 0 ? tracks.length - 1 : prev - 1
    );
    setIsPlaying(true);
  }

  // ===========================
  // 5) Volume slider
  // ===========================
  function handleVolumeChange(e: ChangeEvent<HTMLInputElement>) {
    setVolume(Number(e.target.value));
  }

  // ===========================
  // 6) Pré-fim para troca sem pausa
  // ===========================
  function handleTimeUpdate() {
    const audio = audioRef.current;
    if (!audio || preEndCalledRef.current) return;

    const duration = audio.duration;
    const current = audio.currentTime;

    if (!isFinite(duration) || duration === 0) return;

    const timeLeft = duration - current;

    // se faltar menos de 0.15s para acabar → troca antes
    if (timeLeft <= 0.15) {
      preEndCalledRef.current = true;
      handleEnded();
    }
  }

  // ===========================
  // 7) Telas de estado
  // ===========================
  if (loading) {
    return (
      <main className="radio-bg">
        <div className="radio-card">
          <p className="radio-chip">Carregando player…</p>
          <h1 className="radio-title">Rádio Fórmula Foz</h1>
          <p className="radio-sub">
            Preparando a trilha sonora da loja.
          </p>
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

  // ===========================
  // 8) UI principal do player
  // ===========================
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

          {/* 🔊 Controle de Volume */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <p style={{ marginBottom: 6, opacity: 0.8 }}>Volume</p>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              style={{ width: '80%' }}
            />
          </div>

          <audio
            ref={audioRef}
            src={currentTrack.url}
            onEnded={handleEnded}
            onTimeUpdate={handleTimeUpdate}
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
