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

  // ===== CROSSFADE =====
  const CROSSFADE_SECONDS = 2.0; // 1.5 ~ 3.0 costuma ficar bom

  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioRef = useRef<0 | 1>(0); // 0=A, 1=B
  const crossfadeTriggeredRef = useRef(false);

  // WebAudio
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceARef = useRef<MediaElementAudioSourceNode | null>(null);
  const sourceBRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);

  // ===========================
  // 1) Carrega playlist + músicas
  // ===========================
  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        let activePlaylist = urlPlaylist || '';

        if (!activePlaylist) {
          const { data: config, error: configError } = await supabase
            .from('store_config')
            .select('current_playlist')
            .eq('id', 1)
            .single();

          if (configError) console.error('Erro ao buscar config:', configError);
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

        // reset crossfade
        crossfadeTriggeredRef.current = false;
        activeAudioRef.current = 0;
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

  // ===========================
  // 2) Setup WebAudio Graph
  // ===========================
  function ensureAudioGraph() {
    if (ctxRef.current) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    ctxRef.current = ctx;

    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    const sourceA = ctx.createMediaElementSource(a);
    const sourceB = ctx.createMediaElementSource(b);

    const gainA = ctx.createGain();
    const gainB = ctx.createGain();
    const master = ctx.createGain();

    // estado inicial: A = 1, B = 0
    gainA.gain.value = 1;
    gainB.gain.value = 0;
    master.gain.value = volume;

    sourceA.connect(gainA);
    sourceB.connect(gainB);
    gainA.connect(master);
    gainB.connect(master);
    master.connect(ctx.destination);

    sourceARef.current = sourceA;
    sourceBRef.current = sourceB;
    gainARef.current = gainA;
    gainBRef.current = gainB;
    masterGainRef.current = master;
  }

  // aplica volume no master gain
  useEffect(() => {
    const ctx = ctxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;

    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(volume, now + 0.08);
  }, [volume]);

  // ===========================
  // 3) Start / Switch track (sem useEffect por currentIndex)
  // ===========================
  async function playOnActive(index: number) {
    if (!tracks.length) return;

    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    ensureAudioGraph();

    const ctx = ctxRef.current;
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }

    const active = activeAudioRef.current;
    const activeEl = active === 0 ? a : b;
    const inactiveEl = active === 0 ? b : a;

    // pausa o inativo (segurança)
    inactiveEl.pause();
    inactiveEl.currentTime = 0;

    crossfadeTriggeredRef.current = false;

    // garante gains coerentes
    const gainA = gainARef.current;
    const gainB = gainBRef.current;
    if (ctx && gainA && gainB) {
      const now = ctx.currentTime;
      gainA.gain.cancelScheduledValues(now);
      gainB.gain.cancelScheduledValues(now);
      if (active === 0) {
        gainA.gain.setValueAtTime(1, now);
        gainB.gain.setValueAtTime(0, now);
      } else {
        gainA.gain.setValueAtTime(0, now);
        gainB.gain.setValueAtTime(1, now);
      }
    }

    // seta src e toca
    activeEl.src = tracks[index].url;
    activeEl.currentTime = 0;

    try {
      await activeEl.play();
      setIsPlaying(true);
      setCurrentIndex(index);
    } catch {
      // autoplay bloqueado -> fica parado até clicar
      setIsPlaying(false);
      setCurrentIndex(index);
    }
  }

  // ao carregar tracks, tenta iniciar a primeira
  useEffect(() => {
    if (!tracks.length) return;

    // tenta iniciar automaticamente
    // (se o navegador bloquear, ele cai pra isPlaying=false e você clica Tocar)
    playOnActive(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.length]);

  // play/pause
  useEffect(() => {
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    const active = activeAudioRef.current;
    const activeEl = active === 0 ? a : b;

    if (isPlaying) {
      ensureAudioGraph();
      const ctx = ctxRef.current;
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      activeEl.play().catch(() => setIsPlaying(false));
    } else {
      a.pause();
      b.pause();
    }
  }, [isPlaying]);

  // ===========================
  // 4) Crossfade real
  // ===========================
  function maybeCrossfade(fromEl: HTMLAudioElement) {
    if (!tracks.length) return;
    if (!isPlaying) return;
    if (crossfadeTriggeredRef.current) return;

    const a = audioARef.current;
    const b = audioBRef.current;
    const ctx = ctxRef.current;
    const gainA = gainARef.current;
    const gainB = gainBRef.current;

    if (!a || !b || !ctx || !gainA || !gainB) return;

    // só deixa o áudio "ativo" disparar crossfade
    const active = activeAudioRef.current;
    const activeEl = active === 0 ? a : b;
    if (fromEl !== activeEl) return;

    const duration = activeEl.duration;
    const current = activeEl.currentTime;
    if (!isFinite(duration) || duration <= 0) return;

    const timeLeft = duration - current;

    if (timeLeft <= CROSSFADE_SECONDS) {
      crossfadeTriggeredRef.current = true;

      const nextIndex = (currentIndex + 1) % tracks.length;
      const nextTrack = tracks[nextIndex];
      if (!nextTrack?.url) {
        crossfadeTriggeredRef.current = false;
        return;
      }

      const inactiveEl = active === 0 ? b : a;

      // prepara a próxima faixa no inativo
      inactiveEl.src = nextTrack.url;
      inactiveEl.currentTime = 0;

      inactiveEl
        .play()
        .then(() => {
          const now = ctx.currentTime;

          const gActive = active === 0 ? gainA : gainB;
          const gInactive = active === 0 ? gainB : gainA;

          gActive.gain.cancelScheduledValues(now);
          gInactive.gain.cancelScheduledValues(now);

          // estado inicial garantido
          gActive.gain.setValueAtTime(1, now);
          gInactive.gain.setValueAtTime(0, now);

          // crossfade
          gActive.gain.linearRampToValueAtTime(0, now + CROSSFADE_SECONDS);
          gInactive.gain.linearRampToValueAtTime(1, now + CROSSFADE_SECONDS);

          window.setTimeout(() => {
            // pausa o antigo
            activeEl.pause();
            activeEl.currentTime = 0;

            // troca quem é o ativo
            activeAudioRef.current = active === 0 ? 1 : 0;

            // atualiza UI
            setCurrentIndex(nextIndex);

            crossfadeTriggeredRef.current = false;
          }, Math.max(0, CROSSFADE_SECONDS * 1000 - 30));
        })
        .catch(() => {
          // fallback simples
          crossfadeTriggeredRef.current = false;
          setCurrentIndex((prev) => (prev + 1) % tracks.length);
          playOnActive((currentIndex + 1) % tracks.length);
        });
    }
  }

  function handleTimeUpdateA() {
    const a = audioARef.current;
    if (a) maybeCrossfade(a);
  }
  function handleTimeUpdateB() {
    const b = audioBRef.current;
    if (b) maybeCrossfade(b);
  }

  // navegação manual
  function handleNext() {
    if (!tracks.length) return;
    crossfadeTriggeredRef.current = false;
    const next = (currentIndex + 1) % tracks.length;
    playOnActive(next);
  }

  function handlePrev() {
    if (!tracks.length) return;
    crossfadeTriggeredRef.current = false;
    const prev = currentIndex - 1 < 0 ? tracks.length - 1 : currentIndex - 1;
    playOnActive(prev);
  }

  function handlePlayPause() {
    if (!isPlaying) {
      ensureAudioGraph();
      const ctx = ctxRef.current;
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    }
    setIsPlaying((prev) => !prev);
  }

  function handleVolumeChange(e: ChangeEvent<HTMLInputElement>) {
    setVolume(Number(e.target.value));
  }

  // ===========================
  // Telas de estado
  // ===========================
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

  // ===========================
  // UI principal (igual)
  // ===========================
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

          {/* Dois audios escondidos (crossfade real) */}
          <audio ref={audioARef} onTimeUpdate={handleTimeUpdateA} />
          <audio ref={audioBRef} onTimeUpdate={handleTimeUpdateB} />

          <div className="radio-footer">
            <div className="radio-dot" />
            <span>Reprodução contínua enquanto o navegador estiver aberto.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
