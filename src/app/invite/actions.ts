"use server";

import { notifyInviteEvent } from "@/lib/email/notify-invite";

export async function reportInviteEvent(event: "opened" | "password_set", email: string | null) {
  await notifyInviteEvent({ event, email });
}
