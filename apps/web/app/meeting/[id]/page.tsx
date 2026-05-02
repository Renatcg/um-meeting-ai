import MeetingClient from "./meeting-client";

type MeetingPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MeetingPage({ params }: MeetingPageProps) {
  const { id } = await params;

  return <MeetingClient meetingId={id} />;
}
