import CoevoMeetLanding from "./coevo-meet-landing";

type CoevoMeetPageProps = {
  searchParams?: Promise<{
    ended?: string | string[];
  }>;
};

export default async function CoevoMeetPage({
  searchParams,
}: CoevoMeetPageProps) {
  const params = await searchParams;
  const ended = params?.ended;
  const isMeetingEnded = Array.isArray(ended)
    ? ended.includes("true")
    : ended === "true";

  return <CoevoMeetLanding isMeetingEnded={isMeetingEnded} />;
}
