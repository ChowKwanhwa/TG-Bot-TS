import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { SUPER_ADMIN_EMAIL, TRIAL_DURATION_MS } from "./constants";
import { consumeAuthToken } from "./otp-store";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma) as ReturnType<typeof PrismaAdapter>,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        authToken: { label: "Auth Token", type: "text" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const authToken = credentials?.authToken as string | undefined;
        if (!email || !authToken) return null;

        // Verify the one-time auth token issued after OTP verification
        const verifiedEmail = consumeAuthToken(authToken);
        if (!verifiedEmail || verifiedEmail !== email.toLowerCase().trim()) {
          return null;
        }

        // Find or create user
        let user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          const isSuperAdmin =
            email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
          user = await prisma.user.create({
            data: {
              email,
              role: isSuperAdmin ? "SUPER_ADMIN" : "TRIAL",
              trialExpiresAt: isSuperAdmin
                ? null
                : new Date(Date.now() + TRIAL_DURATION_MS),
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        // First sign-in: runs in Node.js runtime (API route), safe to use Prisma
        token.userId = user.id;
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true, trialExpiresAt: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.trialExpiresAt = dbUser.trialExpiresAt?.toISOString() ?? null;
        }
      }
      // Note: On subsequent requests (middleware/Edge Runtime), we return cached JWT data.
      // Fresh role/trial checks happen in dashboard layout (Node.js Server Component).
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = session.user as any;
        user.role = token.role;
        user.trialExpiresAt = token.trialExpiresAt ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});
