-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('PROFILE_MODIFY', 'MESSAGE_SCRAPE', 'AUTO_CHAT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "bot_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tgSessionId" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "config" JSONB NOT NULL,
    "result" JSONB,
    "bullJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "bot_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bot_tasks_userId_idx" ON "bot_tasks"("userId");

-- CreateIndex
CREATE INDEX "bot_tasks_status_idx" ON "bot_tasks"("status");

-- AddForeignKey
ALTER TABLE "bot_tasks" ADD CONSTRAINT "bot_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_tasks" ADD CONSTRAINT "bot_tasks_tgSessionId_fkey" FOREIGN KEY ("tgSessionId") REFERENCES "tg_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
