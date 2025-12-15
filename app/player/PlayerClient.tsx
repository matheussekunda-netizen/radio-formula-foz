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

const FADE_DURATION = 3; // segundos de crossfade
const FADE_INTERVAL = 100; // ms

export default function PlayerClient() {
  const searchParams = useSearchParams();
  const urlPlaylist = searchParams.get('pl');

  const [playlist, setPlaylist] = useState('loja');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeAudio, setActiveAudio] = useState<'A' | 'B'>('A');
  const [isPlaying, setIsPlaying] = useState(true);
  const [volume, setVolume] = useState(1);

  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFadingRef = useRef(false);

  // ===========================
  // 1) Carrega playlist
  // ===========================
  useEffect(() => {
    async function load() {
      let activePlaylist = urlPlaylist || '';

      if (!activePlaylist) {
        const { data } = await supabase
          .from('store_config')
          .select('current_playlist')
          .eq('id', 1)
          .single();

        activePlaylist = data?.current_playlist ?? 'loja';
      }

      setPlaylist(activePlaylist);

      const { data } = await supabase
        .from('tracks')
        .select('*')
        .eq('active', true)
        .eq('playlist', activePlaylist)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      setTracks(data || []);
      setCurrentIndex(0);
      setActiveAudio('A');
    }

    load();
  }, [urlPlaylist]);

  // ===========================
  // 2) Aplica volume
  // ===========================
  useEffect(() => {
    if (audioARef.current) audioARef.current.volume = volume;
    if (audioBRef.current) audioBRef.current.volume = volume;
  }, [volume]);

  // ===========================
  // 3) Play inicial
  // ===========================
  useEffect(() => {
    if (!isPlaying) return;

    const audio =
      activeAudio === 'A' ? audioARef.current : audioBRef.current;

    audio?.play().catch(() => setIsPlaying(false));
  }, [currentIndex, activeAudio, isPlaying]);

  // ===========================
  // 4) Crossfade
  // ===========================
  function startCrossfade() {
    if (isFadingRef.current) return;
    isFadingRef.current = true;

    const current =
      activeAudio === 'A' ? audioARef.current : audioBRef.current;
    const next =
      activeAudio === 'A' ? audioBRef.current : audioARef.current;

    if (!current || !next) return;

    next.volume = 0;
    next.play();

    const steps = (FADE_DURATION * 1000) / FADE_INTERVAL;
    const step = volume / steps;

    fadeTimerRef.current = setInterval(() => {
      current.volume = Math.max(0, current.volume - step);
      next.volume = Math.min(volume, next.volume + step);

      if (current.volume <= 0) {
        clearInterval(fadeTimerRef.current!);
        current.pause();
        current.currentTime = 0;
        setActiveAudio(activeAudio === 'A' ? 'B' : 'A');
        setCurrentIndex((prev) => (prev + 1) % tracks.length);
        isFadingRef.current = false;
      }
    }, FADE_INTERVAL);
  }

  // ===========================
  // 5) Detecta fim próximo
  // ===========================
  function handleTimeUpdate() {
    const audio =
      activeAudio === 'A' ? audioARef.current : audioBRef.current;
    if (!audio || isFadingRef.current) return;

    if (audio.duration - audio.currentTime <= FADE_DURATION) {
      startCrossfade();
    }
  }

  const currentTrack = tracks[currentIndex];
  const nextTrack = tracks[(currentIndex + 1) % tracks.length];

  if (!currentTrack) return null;

  // ===========================
  // 6) UI
  // ===========================
  return (
    <main className="radio-bg">
      <div className="radio-card">
        <div className="radio-header">
          <h1 className="radio-title">Rádio Fórmula Foz</h1>
          <p className="radio-sub">Playlist: {playlist}</p>
        </div>

        <p className="radio-now-playing">
          Tocando agora: <strong>{currentTrack.name}</strong>
        </p>

        <div className="radio-controls">
          <button
            className="radio-btn primary"
            onClick={() => setIsPlaying((p) => !p)}
          >
            {isPlaying ? 'Pausar' : 'Tocar'}
          </button>
        </div>

        <div style={{ marginTop: 20 }}>
          <p>Volume</p>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setVolume(Number(e.target.value))
            }
          />
        </div>

        {/* Audio A */}
        <audio
          ref={audioARef}
          src={activeAudio === 'A' ? currentTrack.url : nextTrack?.url}
          onTimeUpdate={activeAudio === 'A' ? handleTimeUpdate : undefined}
        />

        {/* Audio B */}
        <audio
          ref={audioBRef}
          src={activeAudio === 'B' ? currentTrack.url : nextTrack?.url}
          onTimeUpdate={activeAudio === 'B' ? handleTimeUpdate : undefined}
        />
      </div>
    </main>
  );
}
