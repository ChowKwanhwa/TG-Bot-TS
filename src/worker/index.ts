import "dotenv/config";
import { Worker, Job } from "bullmq";
import { createRedisConnection } from "../lib/redis";
import { handleProfileModify } from "./handlers/profile-modify";
import { handleMessageScrape } from "./handlers/message-scrape";
import { handleAutoChat, cancelAutoChat } from "./handlers/auto-chat";
import { prisma } from "./prisma";

interface TaskJobData {
  taskId: string;
  tgSessionId: string;
  type: "PROFILE_MODIFY" | "MESSAGE_SCRAPE" | "AUTO_CHAT";
  config: Record<string, unknown>;
}

async function processJob(job: Job<TaskJobData>) {
  const { taskId, tgSessionId, type, config } = job.data;

  // Mark as running
  await prisma.botTask.update({
    where: { id: taskId },
    data: { status: "RUNNING", bullJobId: job.id },
  });

  try {
    switch (type) {
      case "PROFILE_MODIFY":
        await handleProfileModify(
          taskId,
          tgSessionId,
          config as {
            firstName?: string;
            lastName?: string;
            username?: string;
            avatarUrl?: string;
          }
        );
        break;
      case "MESSAGE_SCRAPE":
        await handleMessageScrape(
          taskId,
          tgSessionId,
          config as { targetLink: string; messageCount: number }
        );
        break;
      case "AUTO_CHAT":
        await handleAutoChat(
          taskId,
          tgSessionId,
          config as {
            targetLink: string;
            messages: string[];
            minDelaySec: number;
            maxDelaySec: number;
            maxIterations?: number;
          }
        );
        break;
      default:
        throw new Error(`Unknown task type: ${type}`);
    }
  } catch (err: unknown) {
    const error = err as { message?: string };
    await prisma.botTask.update({
      where: { id: taskId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        result: { error: error.message ?? "Unknown error" },
      },
    });
    throw err;
  }
}

const worker = new Worker<TaskJobData>("bot-tasks", processJob, {
  connection: createRedisConnection(),
  concurrency: 5,
});

worker.on("ready", () => {
  console.log("[Worker] Bot task worker ready");
});

worker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed (task: ${job.data.taskId})`);
});

worker.on("failed", (job, err) => {
  console.error(
    `[Worker] Job ${job?.id} failed (task: ${job?.data.taskId}):`,
    err.message
  );
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("[Worker] Shutting down...");
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("[Worker] Shutting down...");
  await worker.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Export cancel function for use by API
export { cancelAutoChat };

console.log("[Worker] Bot task worker starting...");
