import { Router } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db/schema";
import { usersTable } from "@workspace/db/schema";
import { eq, or, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// GET /api/chat/users — all users + last message + unread count per conversation
router.get("/chat/users", requireAuth, async (req, res) => {
  const me = req.session.userId!;

  const users = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      full_name: usersTable.full_name,
    })
    .from(usersTable)
    .where(sql`${usersTable.id} != ${me}`);

  const results = await Promise.all(
    users.map(async (u) => {
      const [last] = await db
        .select()
        .from(chatMessagesTable)
        .where(
          or(
            and(eq(chatMessagesTable.sender_id, me), eq(chatMessagesTable.receiver_id, u.id)),
            and(eq(chatMessagesTable.sender_id, u.id), eq(chatMessagesTable.receiver_id, me)),
          ),
        )
        .orderBy(desc(chatMessagesTable.created_at))
        .limit(1);

      const [{ count }] = await db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(chatMessagesTable)
        .where(
          and(
            eq(chatMessagesTable.sender_id, u.id),
            eq(chatMessagesTable.receiver_id, me),
            eq(chatMessagesTable.is_read, false),
          ),
        );

      return { ...u, lastMessage: last ?? null, unreadCount: count };
    }),
  );

  res.json(results);
});

// GET /api/chat/messages/:userId — message history with a user
router.get("/chat/messages/:userId", requireAuth, async (req, res) => {
  const me = req.session.userId!;
  const other = Number(req.params.userId);

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(
      or(
        and(eq(chatMessagesTable.sender_id, me), eq(chatMessagesTable.receiver_id, other)),
        and(eq(chatMessagesTable.sender_id, other), eq(chatMessagesTable.receiver_id, me)),
      ),
    )
    .orderBy(chatMessagesTable.created_at);

  res.json(messages);
});

// POST /api/chat/messages/:userId/read — mark incoming messages as read
router.post("/chat/messages/:userId/read", requireAuth, async (req, res) => {
  const me = req.session.userId!;
  const other = Number(req.params.userId);

  await db
    .update(chatMessagesTable)
    .set({ is_read: true })
    .where(
      and(
        eq(chatMessagesTable.sender_id, other),
        eq(chatMessagesTable.receiver_id, me),
        eq(chatMessagesTable.is_read, false),
      ),
    );

  res.json({ ok: true });
});

export default router;
