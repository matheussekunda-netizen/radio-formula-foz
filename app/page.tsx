import { supabase } from '../lib/supabase';

export default async function Home() {
  const { data: tracks, error } = await supabase
    .from("tracks")
    .select("*");

  if (error) {
    console.log(error);
    return <div>Erro: {error.message}</div>;
  }

  return (
    <main className="p-10 text-white">
      <h1 className="text-2xl font-bold">Lista de músicas</h1>

      <div className="mt-4 space-y-4">
        {tracks?.map((t) => (
          <div
            key={t.id}
            className="bg-neutral-800 p-4 rounded-lg"
          >
            <p><strong>Nome:</strong> {t.name}</p>
            <p><strong>URL:</strong> {t.url}</p>
            <p><strong>Ativa:</strong> {t.active ? "Sim" : "Não"}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
