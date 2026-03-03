import { Prisma } from "@prisma/client";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import bigInt from "big-integer";
import { decryptSession } from "../../lib/crypto";
import { prisma } from "../prisma";
import { Upload } from "@aws-sdk/lib-storage";
import { r2Client, getR2PublicUrl } from "../../lib/r2";

interface ScrapeConfig {
  targetLink: string; // e.g. "https://t.me/OneEx_CN"
  messageCount: number;
}

interface ScrapedMessage {
  msgId: number;
  text: string;
  mediaType: string | null;
  mediaUrl: string | null;
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
    const batchLimit = Math.min(config.messageCount, 100);

    while (fetched < config.messageCount) {
      const remaining = config.messageCount - fetched;
      const batchSize = Math.min(batchLimit, remaining);

      let result;
      try {
        result = await client.invoke(
          new Api.messages.GetHistory({
            peer: entity,
            offsetId,
            limit: batchSize,
            addOffset: 0,
            maxId: 0,
            minId: 0,
            hash: bigInt(0),
          })
        );
      } catch (err: any) {
        if (err.errorMessage === "FLOOD_WAIT" || err.seconds) {
          const wait = (err.seconds ?? 30) * 1000;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        throw err;
      }

      const msgs = "messages" in result ? (result.messages as Api.Message[]) : [];
      if (msgs.length === 0) break;

      for (const msg of msgs) {
        if (!msg || !("id" in msg)) continue;

        let mediaType: string | null = null;
        let mediaUrl: string | null = null;

        if (msg.media) {
          if (msg.media instanceof Api.MessageMediaPhoto) {
            mediaType = "photo";
          } else if (msg.media instanceof Api.MessageMediaDocument) {
            mediaType = "document";
          }

          if (mediaType) {
            try {
              const buffer = await client.downloadMedia(msg.media);
              if (buffer) {
                const ext = mediaType === "photo" ? "jpg" : "bin";
                const key = `scraped/${taskId}/${msg.id}.${ext}`;

                const upload = new Upload({
                  client: r2Client,
                  params: {
                    Bucket: process.env.R2_BUCKET_NAME!,
                    Key: key,
                    Body: buffer,
                    ContentType: mediaType === "photo" ? "image/jpeg" : "application/octet-stream",
                  },
                });

                await upload.done();
                mediaUrl = getR2PublicUrl(key) || key;
              }
            } catch (err) {
              console.error(`Failed to download/upload media for msg ${msg.id}:`, err);
            }
          }
        }

        messages.push({
          msgId: msg.id,
          text: ("message" in msg ? (msg.message as string) : "") ?? "",
          mediaType,
          mediaUrl,
          date: msg.date
            ? new Date(msg.date * 1000).toISOString()
            : new Date().toISOString(),
        });

        fetched++;

        // Report progress every 5 messages or at the end
        if (fetched % 5 === 0 || fetched >= config.messageCount) {
          await prisma.botTask.update({
            where: { id: taskId },
            data: {
              result: {
                progress: Math.round((fetched / config.messageCount) * 100),
                fetched,
                total: config.messageCount,
                messages: messages as any,
              } as any,
            },
          });
        }

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
          progress: 100,
          totalMessages: messages.length,
          withMedia: messages.filter((m) => m.mediaUrl).length,
          messages: messages as any,
        } as any,
      },
    });
  } finally {
    await client.disconnect();
  }
}
