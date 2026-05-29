from app.models import Meeting


class InMemoryMeetingStore:
    def __init__(self) -> None:
        self._meetings: dict[str, Meeting] = {}

    def create(
        self,
        title: str,
        organization_id: str = "default",
        meeting_type: str | None = None,
        client_external_id: str | None = None,
        client_name: str | None = None,
        project_external_id: str | None = None,
        project_name: str | None = None,
    ) -> Meeting:
        meeting = Meeting.create(
            title,
            organization_id=organization_id,
            meeting_type=meeting_type,
            client_external_id=client_external_id,
            client_name=client_name,
            project_external_id=project_external_id,
            project_name=project_name,
        )
        self._meetings[meeting.id] = meeting
        return meeting

    def get(self, meeting_id: str) -> Meeting | None:
        return self._meetings.get(meeting_id)

    def ensure(self, meeting_id: str) -> Meeting:
        existing = self.get(meeting_id)
        if existing:
            return existing

        meeting = Meeting.create("Reuniao UM")
        meeting.id = meeting_id
        self._meetings[meeting.id] = meeting
        return meeting


meeting_store = InMemoryMeetingStore()
