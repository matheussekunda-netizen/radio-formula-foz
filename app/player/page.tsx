// app/player/page.tsx
import { Suspense } from 'react';
import PlayerClient from './PlayerClient';

export const dynamic = 'force-dynamic';

export default function PlayerPage() {
  return (
    <Suspense
      fallback={
        <main className="radio-bg">
          <div className="radio-card">
            <p className="radio-chip">Carregando player…</p>
            <h1 className="radio-title">Rádio Fórmula Foz</h1>
            <p className="radio-sub">
              Preparando a trilha sonora da loja.
            </p>
          </div>
        </main>
      }
    >
      <PlayerClient />
    </Suspense>
  );
}
