import { redirect } from "next/navigation";

export default function MeetingEndedRedirectPage() {
  redirect("/coevo-meet?ended=true");
}
