import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { decryptSession } from "../../lib/crypto";
import { prisma } from "../prisma";

interface ProfileModifyConfig {
  firstName?: string;
  lastName?: string;
  username?: string;
  avatarUrl?: string;
  avatarBase64?: string;
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
    let avatarUpdated = false;
    // Get current profile
    const me = await client.getMe() as Api.User;
    const oldName = `${me.firstName ?? ""} ${me.lastName ?? ""}`.trim();
    const oldUsername = me.username;

    // 1. Update Profile (Names)
    if (config.firstName !== undefined || config.lastName !== undefined) {
      await client.invoke(
        new Api.account.UpdateProfile({
          firstName: config.firstName ?? me.firstName ?? "",
          lastName: config.lastName ?? me.lastName ?? "",
        })
      );
    }

    // 2. Update Username
    if (config.username !== undefined && config.username !== oldUsername) {
      await client.invoke(
        new Api.account.UpdateUsername({
          username: config.username,
        })
      );
    }

    // 3. Update Avatar (Profile Photo)
    if (config.avatarBase64) {
      try {
        const base64Data = config.avatarBase64.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const uploadedFile = await client.uploadFile({
          file: buffer as any,
          workers: 1,
        });
        await client.invoke(new Api.photos.UploadProfilePhoto({ file: uploadedFile }));
        avatarUpdated = true;
      } catch (err) {
        console.error("Failed to upload local avatar:", err);
      }
    } else if (config.avatarUrl) {
      try {
        const fetchRes = await fetch(config.avatarUrl);
        if (fetchRes.ok) {
          const arrayBuffer = await fetchRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const uploadedFile = await client.uploadFile({
            file: buffer as any,
            workers: 1,
          });
          await client.invoke(new Api.photos.UploadProfilePhoto({ file: uploadedFile }));
          avatarUpdated = true;
        }
      } catch (err) {
        console.error("Failed to fetch/upload avatar from URL:", err);
      }
    }

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
        result: {
          oldName,
          newName,
          oldUsername: oldUsername ?? "none",
          newUsername: updated.username ?? "none",
          avatarUpdated
        } as unknown as Record<string, string | boolean>,
      },
    });
  } finally {
    await client.disconnect();
  }
}
