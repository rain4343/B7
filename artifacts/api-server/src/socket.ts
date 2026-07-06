import { Server as SocketIOServer } from "socket.io";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";
import { logger } from "./lib/logger";

// userId -> socketId
const onlineUsers = new Map<number, string>();

export function setupSocketIO(io: SocketIOServer) {
  io.on("connection", (socket) => {
    const session = (socket.request as any).session as {
      userId?: number;
      username?: string;
      full_name?: string;
    };

    const userId = session?.userId;
    if (!userId) {
      socket.disconnect();
      return;
    }

    onlineUsers.set(userId, socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));
    logger.info({ userId }, "Chat: user connected");

    // Send a message
    socket.on("send_message", async (data: { receiverId: number; content: string }) => {
      try {
        const { receiverId, content } = data;
        if (!content?.trim() || !receiverId) return;

        const [msg] = await db
          .insert(chatMessagesTable)
          .values({ sender_id: userId, receiver_id: receiverId, content: content.trim() })
          .returning();

        // Echo back to sender
        socket.emit("new_message", msg);

        // Deliver to receiver if online
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("new_message", msg);
        }
      } catch (err) {
        logger.error({ err }, "Chat: send_message error");
      }
    });

    // Mark messages from a sender as read
    socket.on("mark_read", async (data: { senderId: number }) => {
      try {
        await db
          .update(chatMessagesTable)
          .set({ is_read: true })
          .where(
            and(
              eq(chatMessagesTable.sender_id, data.senderId),
              eq(chatMessagesTable.receiver_id, userId),
              eq(chatMessagesTable.is_read, false),
            ),
          );

        // Notify the original sender that their messages were read
        const senderSocketId = onlineUsers.get(data.senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("messages_read", { by: userId, senderId: data.senderId });
        }
      } catch (err) {
        logger.error({ err }, "Chat: mark_read error");
      }
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("online_users", Array.from(onlineUsers.keys()));
      logger.info({ userId }, "Chat: user disconnected");
    });
  });
}
