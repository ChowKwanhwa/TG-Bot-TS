import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { decryptSession } from "../../lib/crypto";
import { prisma } from "../prisma";

interface ProfileModifyConfig {
  firstName?: string;
  lastName?: string;
}

export async function handleProfileModify(
  taskId: string,
  tgSessionId: string,
  config: ProfileModifyConfig
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
    // Get current profile
    const me = await client.getMe() as Api.User;
    const oldName = `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim();

    // Update profile
    await client.invoke(
      new Api.account.UpdateProfile({
        firstName: config.firstName ?? me.firstName ?? "",
        lastName: config.lastName ?? "",
      })
    );

    // Fetch updated profile
    const updated = await client.getMe() as Api.User;
    const newName = `${updated.firstName ?? ""} ${updated.lastName ?? ""}`.trim();

    // Update DB record
    await prisma.tgSession.update({
      where: { id: tgSessionId },
      data: {
        tgFirstName: updated.firstName ?? null,
        tgLastName: updated.lastName ?? null,
        tgUsername: updated.username ?? null,
        lastUsedAt: new Date(),
      },
    });

    await prisma.botTask.update({
      where: { id: taskId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        result: { oldName, newName } as unknown as Record<string, string>,
      },
    });
  } finally {
    await client.disconnect();
  }
}
