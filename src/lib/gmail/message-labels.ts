import "server-only";

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function modifyMessageLabels(
  accessToken: string,
  messageId: string,
  options: { addLabelIds?: string[]; removeLabelIds?: string[] },
): Promise<void> {
  const res = await fetch(
    `${GMAIL_BASE}/messages/${encodeURIComponent(messageId)}/modify`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        addLabelIds: options.addLabelIds ?? [],
        removeLabelIds: options.removeLabelIds ?? [],
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gmail label update failed (${res.status}): ${await res.text()}`);
  }
}

// Trash, not permanent delete — contractors' forwarded correspondence
// should vanish from the mailbox the moment it's processed (they shouldn't
// have to wonder whether we're sitting on their emails), but Trash still
// gives a 30-day recovery window if a processing bug ever mis-handles one,
// rather than destroying the source message the instant it's read.
export async function trashMessage(accessToken: string, messageId: string): Promise<void> {
  const res = await fetch(
    `${GMAIL_BASE}/messages/${encodeURIComponent(messageId)}/trash`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Gmail trash failed (${res.status}): ${await res.text()}`);
  }
}
