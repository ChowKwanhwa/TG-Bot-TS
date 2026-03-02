import { Prisma } from "@prisma/client";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import bigInt from "big-integer";
import { decryptSession } from "../../lib/crypto";
import { prisma } from "../prisma";

interface ScrapeConfig {
  targetLink: string; // e.g. "https://t.me/OneEx_CN"
  messageCount: number;
}

interface ScrapedMessage {
  msgId: number;
  text: string;
  mediaType: string | null;
  date: string;
}

function parseGroupLink(link: string): { username: string; topicId?: number } {
  const url = link.replace(/\/$/, "");
  const match = url.match(/t\.me\/([^/]+)(?:\/(\d+))?/);
  if (!match) throw new Error(`Invalid Telegram link: ${link}`);
  return {
    username: match[1],
    topicId: match[2] ? Number(match[2]) : undefined,
  };
}

export async function handleMessageScrape(
  taskId: string,
  tgSessionId: string,
  config: ScrapeConfig
) {
  // Fetch both records and cross-check ownership (defense-in-depth)
  const [tgSession, task] = await Promise.all([
    prisma.tgSession.findUnique({ where: { id: tgSessionId } }),
    prisma.botTask.findUnique({ where: { id: taskId }, select: { userId: true } }),
  ]);

  if (!tgSession) throw new Error("TG Session not found");
  if (!task) throw new Error("Task not found");
  if (tgSession.userId !== task.userId) {
    throw new Error("Session ownership mismatch: tgSession does not belong to task owner");
  }

  const sessionString = decryptSession(
    tgSession.encryptedSession,
    tgSession.sessionIv,
    tgSession.sessionTag
  );

  const client = new TelegramClient(
    new StringSession(sessionString),
    Number(process.env.API_ID),
    process.env.API_HASH!,
    { connectionRetries: 3 }
  );

  await client.connect();

  try {
    const { username } = parseGroupLink(config.targetLink);
    const entity = await client.getEntity(username);

    const messages: ScrapedMessage[] = [];
    let offsetId = 0;
    let fetched = 0;
    const limit = Math.min(config.messageCount, 100);

    while (fetched < config.messageCount) {
      const batch = Math.min(limit, config.messageCount - fetched);

      let result;
      try {
        result = await client.invoke(
          new Api.messages.GetHistory({
            peer: entity,
            offsetId,
            limit: batch,
            addOffset: 0,
            maxId: 0,
            minId: 0,
            hash: bigInt(0),
          })
        );
      } catch (err: unknown) {
        const error = err as { seconds?: number; errorMessage?: string };
        if (error.errorMessage === "FLOOD_WAIT" || error.seconds) {
          const wait = (error.seconds ?? 30) * 1000;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw err;
      }

      const msgs =
        "messages" in result ? (result.messages as Api.Message[]) : [];
      if (msgs.length === 0) break;

      for (const msg of msgs) {
        if (!msg || !("id" in msg)) continue;

        let mediaType: string | null = null;
        if (msg.media) {
          if (msg.media instanceof Api.MessageMediaPhoto) {
            mediaType = "photo";
          } else if (msg.media instanceof Api.MessageMediaDocument) {
            mediaType = "document";
          }
        }

        messages.push({
          msgId: msg.id,
          text: ("message" in msg ? (msg.message as string) : "") ?? "",
          mediaType,
          date: msg.date
            ? new Date(msg.date * 1000).toISOString()
            : new Date().toISOString(),
        });

        fetched++;
        if (fetched >= config.messageCount) break;
      }

      offsetId = msgs[msgs.length - 1].id;
    }

    await prisma.tgSession.update({
      where: { id: tgSessionId },
      data: { lastUsedAt: new Date() },
    });

    await prisma.botTask.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        result: {
          totalMessages: messages.length,
          withMedia: messages.filter((m) => m.mediaType).length,
          messages: messages as unknown as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
    });
  } finally {
    await client.disconnect();
  }
}
