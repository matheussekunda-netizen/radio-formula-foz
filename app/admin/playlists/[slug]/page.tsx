import { supabase } from "../../../../lib/supabase";

type Track = {
  id: string;
  name: string;
  url: string;
  type: string;
  active: boolean;
  playlist: string;
};

type PageProps = {
  params: {
    slug?: string; // pode vir undefined, então tratamos
  };
};

// Config estática das playlists (só pra texto bonito)
const PLAYLISTS: Record<
  string,
  {
    name: string;
    description?: string | null;
    mood?: string | null;
    segment?: string | null;
  }
> = {
  "cafe-da-manha": {
    name: "Café da Manhã",
    description:
      "Músicas mais suaves, boa pra abertura e primeiras horas do dia.",
    mood: "Calma",
    segment: "Início de turno",
  },
  natal: {
    name: "Natal Fórmula Foz",
    description:
      "Clássicos de Natal e versões modernas pra clima de fim de ano.",
    mood: "Animada",
    segment: "Campanhas de Fim de Ano",
  },
  loja: {
    name: "Trilha Padrão da Loja",
    description:
      "Mix equilibrado pra dia todo: pop leve, hits e algumas nacionais.",
    mood: "Moderada",
    segment: "Posto / Conveniência",
  },
};

export default async function PlaylistDetailPage({ params }: PageProps) {
  // se por qualquer motivo params.slug vier undefined, cai pra "loja"
  const slug = params?.slug ?? "loja";

  // meta da playlist: se não tiver no map, usa genérico com o próprio slug
  const playlist =
    PLAYLISTS[slug] ??
    ({
      name: slug,
      description: null,
      mood: null,
      segment: null,
    } as (typeof PLAYLISTS)[string]);

  // Busca as faixas dessa playlist no Supabase
  const { data: tracksData, error: tError } = await supabase
    .from("tracks")
    .select("*")
    .eq("playlist", slug)
    .order("name", { ascending: true });

  if (tError) {
    console.error("Erro ao buscar faixas da playlist:", tError);
  }

  const tracks: Track[] = tracksData || [];

  return (
    <main className="radio-list-bg">
      <div className="radio-list-shell">
        <header className="radio-list-header">
          <div>
            <p className="radio-chip">Playlist</p>
            <h1 className="radio-list-title">{playlist.name}</h1>
            {playlist.description && (
              <p className="radio-list-sub">{playlist.description}</p>
            )}
          </div>

          <div className="radio-list-badge">
            <span className="radio-dot" />
            <span>
              {tracks.length} música{tracks.length === 1 ? "" : "s"}
            </span>
          </div>
        </header>

        <section className="radio-detail-panel">
          <div className="radio-detail-meta">
            {playlist.mood && (
              <span className="radio-pl-tag">{playlist.mood}</span>
            )}
            {playlist.segment && (
              <span className="radio-pl-tag secondary">
                {playlist.segment}
              </span>
            )}
          </div>

          <div className="radio-detail-actions">
            <a
              href={`/player?pl=${encodeURIComponent(slug)}`}
              className="radio-primary-btn"
              target="_blank"
            >
              Abrir player com essa playlist
            </a>
          </div>
        </section>

        <section className="radio-tracks-list">
          {tracks.length === 0 ? (
            <p className="radio-list-empty">
              Nenhuma faixa cadastrada nessa playlist ainda.
            </p>
          ) : (
            <ul>
              {tracks.map((t) => (
                <li key={t.id} className="radio-track-row">
                  <div>
                    <strong>{t.name}</strong>
                    <p className="radio-track-sub">
                      {t.type || "music"} · {t.active ? "Ativa" : "Inativa"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="radio-detail-footer">
          <a href="/admin/playlists" className="radio-secondary-btn">
            ← Voltar para playlists
          </a>
        </footer>
      </div>
    </main>
  );
}
