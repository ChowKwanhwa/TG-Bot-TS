import { Queue } from "bullmq";
import { createRedisConnection } from "./redis";

let botQueue: Queue | null = null;

export function getBotQueue(): Queue {
  if (!botQueue) {
    botQueue = new Queue("bot-tasks", {
      connection: createRedisConnection(),
    });
  }
  return botQueue;
}
