export interface SlackMessageBlock {
  type: string;
  text?: {
    type: "mrkdwn" | "plain_text";
    text: string;
  };
}

export interface SlackPostMessageInput {
  token: string;
  channel: string;
  text: string;
  blocks?: SlackMessageBlock[];
  fetchImpl?: typeof fetch;
}

export async function postSlackMessage(input: SlackPostMessageInput): Promise<void> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: input.channel,
      text: input.text,
      blocks: input.blocks,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const payload = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(`Slack chat.postMessage failed: ${payload.error ?? response.status}`);
  }
}
