export async function tgCall(token: string, method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(`Telegram API error: ${JSON.stringify(data)}`);
  }
  return data;
}

export function webhookUrl(origin: string, botId: string, secret: string) {
  return `${origin}/tg/${botId}/${secret}/webhook`;
}

export async function setWebhook(token: string, url: string, secret: string) {
  return tgCall(token, "setWebhook", { url, secret_token: secret });
}

export async function getWebhookInfo(token: string) {
  return tgCall(token, "getWebhookInfo", {});
}

export async function sendMessage(token: string, chatId: number | string, text: string) {
  return tgCall(token, "sendMessage", { chat_id: chatId, text });
}
