'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase';

const AUDIO_BASE = process.env.NEXT_PUBLIC_AUDIO_BASE_URL!;

function buildAudioUrl(path: string) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path; // fallback se vier URL completa
  return `${AUDIO_BASE}/${path.replace(/^\/+/, '')}`;
}


type Track = {
  id: string;
  name: string;
  url: string;
  type: string;
  active: boolean;
  playlist: string;
  sort_order?: number | null;
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

  // volume do usuário (0..1)
  const [volume, setVolume] = useState(1);

  // crossfade
  const CROSSFADE_SECONDS = 2.0;
  const FADE_STEP_MS = 60; // suavidade do fade (menor = mais suave)

  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioRef = useRef<0 | 1>(0);
  const crossfadeTriggeredRef = useRef(false);
  const fadeTimerRef = useRef<number | null>(null);

  // limpa timer
  function clearFadeTimer() {
    if (fadeTimerRef.current) {
      window.clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }

  // aplica volume master nos dois (respeita o volume do usuário)
  function setEffectiveVolumes(aVol: number, bVol: number) {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (a) a.volume = Math.max(0, Math.min(1, aVol * volume));
    if (b) b.volume = Math.max(0, Math.min(1, bVol * volume));
  }

  // 1) carregar playlist + tracks
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        let activePlaylist = urlPlaylist || '';
        if (!activePlaylist) {
          const { data: config } = await supabase
            .from('store_config')
            .select('current_playlist')
            .eq('id', 1)
            .single();

          activePlaylist = config?.current_playlist ?? 'loja';
        }

        setPlaylist(activePlaylist);

        const { data, error } = await supabase
          .from('tracks')
          .select('*')
          .eq('active', true)
          .eq('playlist', activePlaylist)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true });

        if (error) throw error;

        setTracks(data || []);
        setCurrentIndex(0);
        activeAudioRef.current = 0;
        crossfadeTriggeredRef.current = false;
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

  const currentTrack = tracks[currentIndex];

  // 2) quando muda faixa oficial, carrega no áudio ativo
  useEffect(() => {
    if (!currentTrack?.url) return;

    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    clearFadeTimer();
    crossfadeTriggeredRef.current = false;

    const active = activeAudioRef.current;
    const activeEl = active === 0 ? a : b;
    const inactiveEl = active === 0 ? b : a;

    inactiveEl.pause();
    inactiveEl.currentTime = 0;

    activeEl.pause();
    activeEl.currentTime = 0;
    activeEl.src = buildAudioUrl(currentTrack.url);

    // volumes iniciais: ativo = 1, inativo = 0
    setEffectiveVolumes(active === 0 ? 1 : 0, active === 0 ? 0 : 1);

    if (isPlaying) {
      activeEl.play().catch(() => setIsPlaying(false));
    }
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // 3) play/pause
  useEffect(() => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    const active = activeAudioRef.current;
    const activeEl = active === 0 ? a : b;

    if (isPlaying) {
      activeEl.play().catch(() => setIsPlaying(false));
    } else {
      a.pause();
      b.pause();
    }
  }, [isPlaying]);

  // 4) se mexer no volume, reaplica volumes atuais mantendo proporção
  useEffect(() => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    // a.volume e b.volume já estão "final", mas a gente precisa garantir que o master mudou
    // então recalculamos baseado em qual é o ativo (sem saber o mix atual exato).
    // (simples e funciona: mantém ativo em 1 e inativo em 0 quando não está em crossfade)
    const active = activeAudioRef.current;
    setEffectiveVolumes(active === 0 ? 1 : 0, active === 0 ? 0 : 1);
  }, [volume]);

  // 5) crossfade (SEM WebAudio)
  function maybeCrossfade() {
    if (!tracks.length) return;
    if (crossfadeTriggeredRef.current) return;
    if (!isPlaying) return;

    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    const active = activeAudioRef.current;
    const activeEl = active === 0 ? a : b;
    const inactiveEl = active === 0 ? b : a;

    const duration = activeEl.duration;
    const current = activeEl.currentTime;
    if (!isFinite(duration) || duration <= 0) return;

    const timeLeft = duration - current;

    if (timeLeft <= CROSSFADE_SECONDS) {
      crossfadeTriggeredRef.current = true;
      clearFadeTimer();

      const nextIndex = (currentIndex + 1) % tracks.length;
      const nextTrack = tracks[nextIndex];
      if (!nextTrack?.url) return;

      inactiveEl.pause();
      inactiveEl.currentTime = 0;
      inactiveEl.src = buildAudioUrl(nextTrack.url);

      // inicia inativo com volume 0
      setEffectiveVolumes(active === 0 ? 1 : 0, active === 0 ? 0 : 1);

      inactiveEl.play().then(() => {
        const steps = Math.max(1, Math.round((CROSSFADE_SECONDS * 1000) / FADE_STEP_MS));
        let i = 0;

        fadeTimerRef.current = window.setInterval(() => {
          i++;
          const t = i / steps; // 0..1

          // linear fade
          const outVol = 1 - t;
          const inVol = t;

          if (active === 0) setEffectiveVolumes(outVol, inVol);
          else setEffectiveVolumes(inVol, outVol);

          if (i >= steps) {
            clearFadeTimer();

            activeEl.pause();
            activeEl.currentTime = 0;

            activeAudioRef.current = active === 0 ? 1 : 0;
            setCurrentIndex(nextIndex);

            crossfadeTriggeredRef.current = false;
          }
        }, FADE_STEP_MS);
      }).catch(() => {
        // fallback: troca normal
        setCurrentIndex((prev) => (prev + 1) % tracks.length);
        crossfadeTriggeredRef.current = false;
      });
    }
  }

  function handleTimeUpdate() {
    maybeCrossfade();
  }

  // controles
  function handlePlayPause() {
    setIsPlaying((prev) => !prev);
  }
  function handleNext() {
    if (!tracks.length) return;
    clearFadeTimer();
    crossfadeTriggeredRef.current = false;
    setCurrentIndex((prev) => (prev + 1) % tracks.length);
    setIsPlaying(true);
  }
  function handlePrev() {
    if (!tracks.length) return;
    clearFadeTimer();
    crossfadeTriggeredRef.current = false;
    setCurrentIndex((prev) => (prev - 1 < 0 ? tracks.length - 1 : prev - 1));
    setIsPlaying(true);
  }
  function handleVolumeChange(e: ChangeEvent<HTMLInputElement>) {
    setVolume(Number(e.target.value));
  }

  // UI estados
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
              <p>{error || 'Nenhuma música ativa encontrada para esta playlist.'}</p>
              <small>
                Playlist atual: <strong>{playlist}</strong>
              </small>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // UI principal (igual)
  return (
    <main className="radio-bg">
      <div className="radio-card">
        <div className="radio-header">
          <div>
            <p className="radio-chip">Player da loja</p>
            <h1 className="radio-title">Rádio Fórmula Foz</h1>
            <p className="radio-sub">Ambiente pronto para receber os clientes.</p>
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
            <button type="button" className="radio-btn ghost" onClick={handlePrev}>
              ‹‹
            </button>

            <button type="button" className="radio-btn primary" onClick={handlePlayPause}>
              {isPlaying ? 'Pausar' : 'Tocar'}
            </button>

            <button type="button" className="radio-btn ghost" onClick={handleNext}>
              ››
            </button>
          </div>

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

          {/* 2 audios (um ativo e outro “próximo”) */}
          <audio ref={audioARef} onTimeUpdate={handleTimeUpdate} />
          <audio ref={audioBRef} onTimeUpdate={handleTimeUpdate} />

          <div className="radio-footer">
            <div className="radio-dot" />
            <span>Reprodução contínua enquanto o navegador estiver aberto.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
