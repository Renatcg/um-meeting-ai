"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("Reuniao comercial");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createMeeting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch(`${apiUrl}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error("Nao foi possivel criar a reuniao.");
      }

      const meeting = (await response.json()) as { id: string };
      router.push(`/meeting/${meeting.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro inesperado.");
      setIsCreating(false);
    }
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setUploadMessage(null);
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function uploadKnowledgeDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadMessage(null);

    if (!selectedFile) {
      setUploadMessage("Selecione um arquivo PDF, DOCX, TXT ou MD.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${apiUrl}/knowledge/documents`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(body?.detail ?? "Nao foi possivel enviar o documento.");
      }

      const payload = (await response.json()) as {
        document: { filename: string; chunk_count: number };
      };
      setUploadMessage(
        `${payload.document.filename} indexado com ${payload.document.chunk_count} chunks.`,
      );
      setSelectedFile(null);
    } catch (err) {
      setUploadMessage(err instanceof Error ? err.message : "Erro inesperado.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <section className="grid w-full max-w-5xl gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <p className="mb-3 text-sm font-medium uppercase tracking-wide text-brand">
            UM Meeting AI
          </p>
          <h1 className="text-4xl font-semibold text-ink">
            Crie uma sala LiveKit com Copilot e base de conhecimento.
          </h1>
          <p className="mt-4 text-base leading-7 text-neutral-700">
            A plataforma cria a reuniao, coleta dados do participante, exige
            aceite LGPD e conecta o UM Copilot para audio, transcricao, painel
            comercial privado e consulta a documentos.
          </p>

          <form onSubmit={createMeeting} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                Nome da reuniao
              </span>
              <input
                className="w-full rounded-md border border-line bg-white px-4 py-3 text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </label>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <button
              className="rounded-md bg-brand px-5 py-3 font-medium text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isCreating}
              type="submit"
            >
              {isCreating ? "Criando..." : "Criar reuniao"}
            </button>
          </form>
        </div>

        <form
          onSubmit={uploadKnowledgeDocument}
          className="self-start rounded-lg border border-line bg-white p-6 shadow-sm"
        >
          <p className="text-sm font-medium uppercase tracking-wide text-accent">
            Base de conhecimento
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">
            Envie documentos para o Copilot consultar.
          </h2>
          <p className="mt-3 text-sm leading-6 text-neutral-600">
            Aceita PDF, DOCX, TXT e MD. O conteudo sera extraido, quebrado em
            chunks e indexado com embeddings.
          </p>

          <label className="mt-6 block">
            <span className="mb-2 block text-sm font-medium text-ink">
              Documento
            </span>
            <input
              accept=".pdf,.docx,.txt,.md"
              className="w-full rounded-md border border-line bg-mist px-4 py-3 text-sm text-ink file:mr-4 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
              onChange={selectFile}
              type="file"
            />
          </label>

          {uploadMessage ? (
            <p className="mt-4 text-sm leading-6 text-neutral-700">
              {uploadMessage}
            </p>
          ) : null}

          <button
            className="mt-5 rounded-md bg-ink px-5 py-3 font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isUploading}
            type="submit"
          >
            {isUploading ? "Indexando..." : "Enviar documento"}
          </button>
        </form>
      </section>
    </main>
  );
}
