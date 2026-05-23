from __future__ import annotations

import os
import subprocess
from pathlib import Path

from fastapi import HTTPException

from app.models import (
    DevConsoleAction,
    DevConsoleFile,
    DevConsoleFileContentResponse,
    DevConsoleGitDiffResponse,
    DevConsoleProject,
    DevConsoleRestorePoint,
    DevConsoleState,
)


EXCLUDED_PARTS = {
    ".git",
    ".next",
    ".turbo",
    ".venv",
    "__pycache__",
    "node_modules",
}

CODE_SUFFIXES = {
    ".css",
    ".html",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".py",
    ".sql",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}

IMAGE_SUFFIXES = {".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"}

DEFAULT_PROJECT_FILES = (
    "apps/web/app/dev-console/page.tsx",
    "apps/web/app/home-v2/page.tsx",
    "apps/web/app/coevo-labs/page.tsx",
    "apps/api/app/dev_console_service.py",
    "apps/api/app/main.py",
    "apps/api/app/models.py",
)


def _repo_root() -> Path:
    configured_root = os.getenv("DEV_CONSOLE_REPO_ROOT")
    if configured_root:
        return Path(configured_root).expanduser().resolve()

    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / ".git").exists():
            return parent

    return current.parents[1]


REPO_ROOT = _repo_root()


def _run_git(args: list[str], *, timeout: int = 10) -> subprocess.CompletedProcess[str] | None:
    try:
        return subprocess.run(
            ["git", *args],
            cwd=REPO_ROOT,
            check=False,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return None


def _safe_relative_path(path: str) -> Path:
    candidate = Path(path)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise HTTPException(status_code=400, detail="Caminho de arquivo invalido.")
    if any(part in EXCLUDED_PARTS for part in candidate.parts):
        raise HTTPException(status_code=400, detail="Caminho de arquivo bloqueado.")

    absolute = (REPO_ROOT / candidate).resolve()
    try:
        absolute.relative_to(REPO_ROOT)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Arquivo fora do projeto.") from exc

    return candidate


def _file_kind(path: str) -> str:
    suffix = Path(path).suffix.lower()
    if suffix in IMAGE_SUFFIXES:
        return "image"
    if suffix in CODE_SUFFIXES:
        return "code"
    return "text"


def _status_label(raw_status: str) -> str | None:
    status = raw_status.strip()
    if not status:
        return None
    if "??" in status:
        return "A"
    if "M" in status:
        return "M"
    if "D" in status:
        return "D"
    if "R" in status:
        return "R"
    return status[:1]


def _git_status_entries() -> list[tuple[str, str]]:
    result = _run_git(["status", "--short"])
    if result is None or result.returncode != 0:
        return []

    entries: list[tuple[str, str]] = []
    for line in result.stdout.splitlines():
        if len(line) < 4:
            continue
        status = line[:2]
        path = line[3:]
        if " -> " in path:
            path = path.split(" -> ", 1)[1]
        if path and not any(part in EXCLUDED_PARTS for part in Path(path).parts):
            entries.append((status, path))
    return entries


def _build_files() -> list[DevConsoleFile]:
    changed_entries = _git_status_entries()
    changed_paths = {path for _, path in changed_entries}
    files: list[DevConsoleFile] = []

    for status, path in changed_entries:
        files.append(
            DevConsoleFile(
                id=path,
                group="Alterados",
                name=path,
                kind=_file_kind(path),
                status=_status_label(status),
            )
        )

    for path in DEFAULT_PROJECT_FILES:
        if path in changed_paths or not (REPO_ROOT / path).exists():
            continue
        files.append(
            DevConsoleFile(
                id=path,
                group="Sistema",
                name=path,
                kind=_file_kind(path),
            )
        )

    return files


def _build_restore_points() -> list[DevConsoleRestorePoint]:
    result = _run_git(["log", "--oneline", "-8"])
    if result is None or result.returncode != 0:
        return []

    points: list[DevConsoleRestorePoint] = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        commit_hash, _, message = line.partition(" ")
        points.append(
            DevConsoleRestorePoint(
                id=commit_hash,
                title=message or commit_hash,
                detail=commit_hash,
            )
        )
    return points


def _terminal_lines() -> list[str]:
    branch_result = _run_git(["branch", "--show-current"])
    status_entries = _git_status_entries()
    branch = (
        branch_result.stdout.strip()
        if branch_result is not None and branch_result.returncode == 0
        else "sem-repo"
    )
    changed_count = len(status_entries)

    lines = [
        f"coevo-dev {REPO_ROOT.name} {branch} > estado real do projeto carregado",
        f"[ok] git branch: {branch}",
        f"[ok] arquivos alterados: {changed_count}",
    ]
    if branch_result is None:
        lines.append("[aviso] git nao esta disponivel neste ambiente de API")
    elif branch_result.returncode != 0:
        lines.append("[aviso] repositorio git completo nao esta disponivel neste ambiente")
    if changed_count:
        lines.extend(f"[{status.strip() or '??'}] {path}" for status, path in status_entries[:12])
    else:
        lines.append("[ok] worktree sem alteracoes locais")
    return lines


def get_dev_console_state(
    *,
    projects: list[DevConsoleProject] | None = None,
    active_project_id: str = "um-meeting-ai",
) -> DevConsoleState:
    return DevConsoleState(
        chats=[],
        restore_points=_build_restore_points(),
        files=_build_files(),
        terminal_lines=_terminal_lines(),
        projects=projects or [],
        active_project_id=active_project_id,
    )


def get_dev_console_file(path: str) -> DevConsoleFileContentResponse:
    relative_path = _safe_relative_path(path)
    absolute_path = REPO_ROOT / relative_path
    if not absolute_path.exists() or not absolute_path.is_file():
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")

    kind = _file_kind(str(relative_path))
    if kind == "image":
        return DevConsoleFileContentResponse(
            path=str(relative_path),
            name=absolute_path.name,
            kind=kind,
            content=None,
        )

    try:
        content = absolute_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = absolute_path.read_text(encoding="latin-1")

    return DevConsoleFileContentResponse(
        path=str(relative_path),
        name=absolute_path.name,
        kind=kind,
        content=content[:40000],
    )


def get_dev_console_diff(path: str | None = None) -> DevConsoleGitDiffResponse:
    args = ["diff", "--"]
    if path:
        args.append(str(_safe_relative_path(path)))

    result = _run_git(args, timeout=20)
    if result is None:
        return DevConsoleGitDiffResponse(
            diff="Git nao esta disponivel neste ambiente de API.",
            terminal_lines=_terminal_lines(),
        )
    if result.returncode != 0:
        return DevConsoleGitDiffResponse(
            diff=result.stderr.strip() or "Repositorio git completo nao esta disponivel neste ambiente.",
            terminal_lines=_terminal_lines(),
        )

    diff = result.stdout or "Sem alteracoes locais para exibir."
    return DevConsoleGitDiffResponse(
        diff=diff[:60000],
        terminal_lines=_terminal_lines(),
    )


def run_dev_console_action(
    *,
    action: DevConsoleAction,
    restore_point_id: str | None = None,
    projects: list[DevConsoleProject] | None = None,
    active_project_id: str = "um-meeting-ai",
) -> tuple[DevConsoleState, str | None]:
    if action == "diff":
        return (
            get_dev_console_state(
                projects=projects,
                active_project_id=active_project_id,
            ),
            restore_point_id,
        )
    if action == "restore":
        return (
            get_dev_console_state(
                projects=projects,
                active_project_id=active_project_id,
            ),
            restore_point_id,
        )

    raise HTTPException(
        status_code=501,
        detail=(
            "Esta acao ainda nao foi conectada a um executor seguro. "
            "Por enquanto o console le arquivos, status e diff reais."
        ),
    )
