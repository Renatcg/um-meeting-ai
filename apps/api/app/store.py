from app.models import Meeting


class InMemoryMeetingStore:
    def __init__(self) -> None:
        self._meetings: dict[str, Meeting] = {}

    def create(self, title: str) -> Meeting:
        meeting = Meeting.create(title)
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
