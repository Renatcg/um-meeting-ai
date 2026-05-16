import logging

from app.config import Settings
from app.database import (
    claim_meeting_processing_job,
    list_due_meeting_processing_jobs,
    mark_meeting_processing_job_completed,
    mark_meeting_processing_job_failed,
    upsert_meeting_processing_job,
)
from app.memory_service import process_meeting_memory
from app.models import MeetingProcessingJob

logger = logging.getLogger(__name__)


async def enqueue_meeting_memory_processing(
    *,
    settings: Settings,
    meeting_id: str,
    force: bool = False,
) -> MeetingProcessingJob:
    return await upsert_meeting_processing_job(
        settings=settings,
        meeting_id=meeting_id,
        job_type="memory",
        force=force,
    )


async def run_meeting_processing_job(
    *,
    settings: Settings,
    job_id: int,
    force: bool = False,
) -> MeetingProcessingJob | None:
    job = await claim_meeting_processing_job(settings=settings, job_id=job_id)
    if job is None:
        return None

    try:
        if job.job_type != "memory":
            raise ValueError(f"Unsupported processing job type: {job.job_type}")

        result = await process_meeting_memory(
            settings=settings,
            meeting_id=job.meeting_id,
            force=force,
        )
        if result.skipped and result.reason == "No transcript found for this meeting.":
            raise RuntimeError(result.reason)

        return await mark_meeting_processing_job_completed(
            settings=settings,
            job_id=job.id,
            result=result.model_dump(mode="json"),
        )
    except Exception as exc:
        logger.exception("meeting processing job failed")
        return await mark_meeting_processing_job_failed(
            settings=settings,
            job_id=job.id,
            error=str(exc) or exc.__class__.__name__,
        )


async def run_due_meeting_processing_jobs(
    *,
    settings: Settings,
    limit: int = 10,
) -> list[MeetingProcessingJob]:
    due_jobs = await list_due_meeting_processing_jobs(settings=settings, limit=limit)
    processed: list[MeetingProcessingJob] = []

    for job in due_jobs:
        processed_job = await run_meeting_processing_job(
            settings=settings,
            job_id=job.id,
        )
        if processed_job is not None:
            processed.append(processed_job)

    return processed
