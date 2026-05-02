from io import BytesIO
from pathlib import Path

from docx import Document
from fastapi import HTTPException, UploadFile, status
from openai import AsyncOpenAI, OpenAIError
from pypdf import PdfReader

from app.config import Settings
from app.database import (
    get_knowledge_document,
    insert_knowledge_chunks,
    insert_knowledge_document,
    search_knowledge_chunks,
)
from app.models import (
    KnowledgeSearchResponse,
    KnowledgeUploadResponse,
)

SUPPORTED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
SUPPORTED_MEDIA_EXTENSIONS = {
    ".mp3",
    ".mp4",
    ".mpeg",
    ".mpga",
    ".m4a",
    ".wav",
    ".webm",
    ".mov",
}
CHUNK_SIZE = 1200
CHUNK_OVERLAP = 180


def ensure_openai_configured(settings: Settings) -> None:
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENAI_API_KEY is required for knowledge embeddings.",
        )


def get_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def extract_pdf_text(content: bytes) -> str:
    reader = PdfReader(BytesIO(content))
    return "\n\n".join(page.extract_text() or "" for page in reader.pages)


def extract_docx_text(content: bytes) -> str:
    document = Document(BytesIO(content))
    paragraphs = [paragraph.text for paragraph in document.paragraphs]
    return "\n".join(paragraph for paragraph in paragraphs if paragraph.strip())


def extract_text_file(content: bytes) -> str:
    try:
        return content.decode("utf-8")
    except UnicodeDecodeError:
        return content.decode("latin-1")


def extract_text(filename: str, content: bytes) -> str:
    extension = get_extension(filename)
    if extension not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported files are PDF, DOCX, TXT and MD.",
        )

    if extension == ".pdf":
        return extract_pdf_text(content)
    if extension == ".docx":
        return extract_docx_text(content)
    return extract_text_file(content)


def chunk_text(text: str) -> list[str]:
    normalized = "\n".join(line.strip() for line in text.splitlines())
    normalized = "\n".join(line for line in normalized.splitlines() if line)
    if not normalized:
        return []

    chunks: list[str] = []
    start = 0
    while start < len(normalized):
        end = min(start + CHUNK_SIZE, len(normalized))
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(normalized):
            break
        start = max(0, end - CHUNK_OVERLAP)

    return chunks


async def embed_texts(
    *,
    settings: Settings,
    texts: list[str],
) -> list[list[float]]:
    ensure_openai_configured(settings)
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.embeddings.create(
        model=settings.openai_embedding_model,
        input=texts,
    )
    return [item.embedding for item in response.data]


async def ingest_text_content(
    *,
    settings: Settings,
    meeting_id: str | None,
    filename: str,
    content_type: str,
    size_bytes: int,
    text: str,
) -> KnowledgeUploadResponse:
    chunks = chunk_text(text)

    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No readable text was found in the document.",
        )

    embeddings = await embed_texts(settings=settings, texts=chunks)
    document = await insert_knowledge_document(
        settings=settings,
        meeting_id=meeting_id,
        filename=filename,
        content_type=content_type,
        size_bytes=size_bytes,
    )
    await insert_knowledge_chunks(
        settings=settings,
        document_id=document.id,
        chunks=chunks,
        embeddings=embeddings,
    )
    document = await get_knowledge_document(settings=settings, document_id=document.id)
    return KnowledgeUploadResponse(document=document)


async def ingest_knowledge_document(
    *,
    settings: Settings,
    file: UploadFile,
    meeting_id: str | None = None,
) -> KnowledgeUploadResponse:
    filename = file.filename or "document.txt"
    content = await file.read()
    text = extract_text(filename, content)
    return await ingest_text_content(
        settings=settings,
        meeting_id=meeting_id,
        filename=filename,
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(content),
        text=text,
    )


async def transcribe_media_content(
    *,
    settings: Settings,
    filename: str,
    content: bytes,
) -> str:
    ensure_openai_configured(settings)
    extension = get_extension(filename)
    if extension not in SUPPORTED_MEDIA_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supported media files are MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM and MOV.",
        )

    media_file = BytesIO(content)
    media_file.name = filename
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        transcription = await client.audio.transcriptions.create(
            model=settings.openai_media_transcription_model,
            file=media_file,
        )
    except OpenAIError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nao foi possivel transcrever a midia enviada.",
        ) from exc
    return transcription.text


async def ingest_knowledge_media(
    *,
    settings: Settings,
    file: UploadFile,
    meeting_id: str | None = None,
) -> KnowledgeUploadResponse:
    filename = file.filename or "media.mp3"
    content = await file.read()
    transcript = await transcribe_media_content(
        settings=settings,
        filename=filename,
        content=content,
    )
    return await ingest_text_content(
        settings=settings,
        meeting_id=meeting_id,
        filename=f"{filename}.transcript.txt",
        content_type="text/plain",
        size_bytes=len(content),
        text=transcript,
    )


async def search_knowledge(
    *,
    settings: Settings,
    query: str,
    top_k: int,
    meeting_id: str | None = None,
) -> KnowledgeSearchResponse:
    embeddings = await embed_texts(settings=settings, texts=[query])
    results = await search_knowledge_chunks(
        settings=settings,
        query_embedding=embeddings[0],
        top_k=top_k,
        meeting_id=meeting_id,
    )
    return KnowledgeSearchResponse(results=list(results))
