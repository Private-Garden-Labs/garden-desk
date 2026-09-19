import { z } from "zod";
import {
  AgentRunIdSchema,
  AttachmentIdSchema,
  ContentHashSchema,
  FolderIdSchema,
  MessageIdSchema,
  SessionIdSchema,
} from "./ids.js";

export const FolderSummarySchema = z.object({
  id: FolderIdSchema,
  name: z.string().min(1),
  createdAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable().default(null),
});

export const MAX_SESSION_TITLE_LENGTH = 60;
export const SessionTitleSchema = z.string().trim().min(1).max(MAX_SESSION_TITLE_LENGTH);

export const SessionSummarySchema = z.object({
  id: SessionIdSchema,
  folderId: FolderIdSchema.nullable(),
  title: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const SessionPageSchema = z.object({
  items: z.array(SessionSummarySchema),
  nextCursor: z.string().min(1).nullable(),
});

export const MessageRoleSchema = z.enum(["user", "assistant"]);
export const ConversationMessageSchema = z.object({
  id: MessageIdSchema,
  sessionId: SessionIdSchema,
  role: MessageRoleSchema,
  content: z.string().trim().min(1).max(256_000),
  runId: AgentRunIdSchema.nullable().default(null),
  createdAt: z.iso.datetime(),
});

export const SessionDraftSchema = z.object({
  sessionId: SessionIdSchema,
  content: z.string().max(256_000),
  updatedAt: z.iso.datetime(),
});

export const AttachmentSummarySchema = z.object({
  id: AttachmentIdSchema,
  sessionId: SessionIdSchema,
  name: z.string().min(1).max(255),
  mediaType: z.string().min(1).max(255),
  byteLength: z
    .number()
    .int()
    .nonnegative()
    .max(512 * 1024 * 1024),
  contentHash: ContentHashSchema,
  createdAt: z.iso.datetime(),
});

export type FolderSummary = z.infer<typeof FolderSummarySchema>;
export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type SessionPage = z.infer<typeof SessionPageSchema>;
export type MessageRole = z.infer<typeof MessageRoleSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type SessionDraft = z.infer<typeof SessionDraftSchema>;
export type AttachmentSummary = z.infer<typeof AttachmentSummarySchema>;
