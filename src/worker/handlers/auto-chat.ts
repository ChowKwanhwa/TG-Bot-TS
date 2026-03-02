import { Prisma } from "@prisma/client";
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { decryptSession } from "../../lib/crypto";
import { prisma } from "../prisma";

interface AutoChatConfig {
  targetLink: string;
  messages: string[]; // corpus
  minDelaySec: number; // e.g. 2
  maxDelaySec: number; // e.g. 5
  maxIterations?: number; // null = infinite, capped for safety
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

function randomDelay(minSec: number, maxSec: number): number {
  return (minSec + Math.random() * (maxSec - minSec)) * 1000;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Track running jobs so we can cancel them
const runningJobs = new Map<string, { cancelled: boolean }>();

export function cancelAutoChat(taskId: string) {
  const job = runningJobs.get(taskId);
  if (job) job.cancelled = true;
}

export async function handleAutoChat(
  taskId: string,
  tgSessionId: string,
  config: AutoChatConfig
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

  const control = { cancelled: false };
  runningJobs.set(taskId, control);

  try {
    const { username, topicId } = parseGroupLink(config.targetLink);
    const entity = await client.getEntity(username);

    const maxIter = config.maxIterations ?? 999999;
    let sent = 0;
    const sentLog: Array<{ text: string; sentAt: string; iteration: number }> =
      [];

    for (let i = 0; i < maxIter; i++) {
      // Check for cancellation
      if (control.cancelled) {
        break;
      }

      // Re-check task status from DB (in case of external cancel)
      if (i % 10 === 0 && i > 0) {
        const task = await prisma.botTask.findUnique({
          where: { id: taskId },
          select: { status: true },
        });
        if (task?.status === "CANCELLED") {
          control.cancelled = true;
          break;
        }
      }

      const text = pickRandom(config.messages);

      try {
        const sendParams: {
          entity: Api.TypeEntityLike;
          message: string;
          replyTo?: number;
        } = {
          entity,
          message: text,
        };

        if (topicId) {
          sendParams.replyTo = topicId;
        }

        await client.sendMessage(sendParams.entity, {
          message: sendParams.message,
          replyTo: sendParams.replyTo,
        });

        sent++;
        sentLog.push({
          text,
          sentAt: new Date().toISOString(),
          iteration: i + 1,
        });

        // Update progress periodically
        if (sent % 5 === 0) {
          await prisma.botTask.update({
            where: { id: taskId },
            data: {
              result: {
                messagesSent: sent,
                lastSentAt: new Date().toISOString(),
                log: sentLog.slice(-20),
              } as unknown as Prisma.InputJsonValue,
            },
          });
        }
      } catch (err: unknown) {
        const error = err as { seconds?: number; errorMessage?: string };
        if (error.errorMessage?.startsWith("FLOOD_WAIT") || error.seconds) {
          const wait = (error.seconds ?? 60) * 1000;
          await new Promise((r) => setTimeout(r, wait));
          continue; // retry same iteration
        }
        throw err;
      }

      // Jitter delay
      const delay = randomDelay(config.minDelaySec, config.maxDelaySec);
      await new Promise((r) => setTimeout(r, delay));
    }

    await prisma.tgSession.update({
      where: { id: tgSessionId },
      data: { lastUsedAt: new Date() },
    });

    const finalStatus = control.cancelled ? "CANCELLED" : "COMPLETED";
    await prisma.botTask.update({
      where: { id: taskId },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        result: {
          messagesSent: sent,
          cancelled: control.cancelled,
          log: sentLog.slice(-50),
        } as unknown as Prisma.InputJsonValue,
      },
    });
  } finally {
    runningJobs.delete(taskId);
    await client.disconnect();
  }
}
