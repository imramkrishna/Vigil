import { Router } from "express";
import {
  clearChatsController,
  createChatController,
  deleteChatController,
  getChatController,
  listChatsController,
  renameChatController,
} from "../controllers";
import { requireAuth } from "../middleware/require-auth";

export const chatsRouter = Router();

chatsRouter.get("/", requireAuth, listChatsController);
chatsRouter.post("/", requireAuth, createChatController);
chatsRouter.get("/:id", requireAuth, getChatController);
chatsRouter.patch("/:id", requireAuth, renameChatController);
chatsRouter.delete("/:id", requireAuth, deleteChatController);
chatsRouter.delete("/", requireAuth, clearChatsController);
