import { supabase } from "../../../lib/supabase";

type Playlist = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  mood: string | null;
  segment: string | null;
  cover_url: string | null;
  total_tracks: number | null;
};

export default async function PlaylistsPage() {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('Erro ao buscar playlists:', error);
  }

  const playlists: Playlist[] = data || [];

  return (
    <main className="radio-list-bg">
      <div className="radio-list-shell">
        <header className="radio-list-header">
          <div>
            <p className="radio-chip">Playlists</p>
            <h1 className="radio-list-title">Rádio Fórmula Foz</h1>
            <p className="radio-list-sub">
              Escolha a trilha que combina com o momento da loja.
            </p>
          </div>

          <div className="radio-list-badge">
            <span className="radio-dot" />
            <span>{playlists.length} playlists disponíveis</span>
          </div>
        </header>

        <section className="radio-grid">
          {playlists.map((pl) => (
            <a
              key={pl.id}
              href={`/admin/playlists/${pl.slug}`}
              className="radio-pl-card"
            >
              <div
                className={
                  'radio-pl-cover ' +
                  (pl.cover_url ? 'radio-pl-cover-image' : '')
                }
                style={
                  pl.cover_url
                    ? { backgroundImage: `url(${pl.cover_url})` }
                    : undefined
                }
              >
                {!pl.cover_url && (
                  <div className="radio-pl-cover-inner">
                    <span className="radio-pl-mood">
                      {pl.mood || 'Trilha'}
                    </span>
                    <span className="radio-pl-icon">♫</span>
                  </div>
                )}
              </div>

              <div className="radio-pl-info">
                <h2>{pl.name}</h2>
                {pl.description && <p>{pl.description}</p>}
              </div>

              <div className="radio-pl-meta">
                <span className="radio-pl-tag">
                  {pl.mood || 'Equilibrada'}
                </span>

                {pl.segment && (
                  <span className="radio-pl-tag secondary">
                    {pl.segment}
                  </span>
                )}

                {typeof pl.total_tracks === 'number' &&
                  pl.total_tracks > 0 && (
                    <span className="radio-pl-tracks">
                      {pl.total_tracks} músicas
                    </span>
                  )}
              </div>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}
