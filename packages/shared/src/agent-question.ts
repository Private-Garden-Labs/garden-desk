import { z } from "zod";
import { AgentQuestionIdSchema, AgentRunIdSchema } from "./ids.js";

export const AgentQuestionOptionSchema = z.object({
  label: z.string().min(1).max(80),
  description: z.string().max(300).default(""),
});

export const AgentQuestionSchema = z.object({
  header: z.string().min(1).max(30),
  question: z.string().min(1).max(500),
  options: z.array(AgentQuestionOptionSchema).min(2).max(5),
  multiple: z.boolean().optional(),
});

export const AgentQuestionRequestSchema = z.object({
  id: AgentQuestionIdSchema,
  runId: AgentRunIdSchema,
  questions: z.array(AgentQuestionSchema).min(1).max(3),
  createdAt: z.iso.datetime(),
});

// Five offered options plus one typed custom answer for a multiple-choice question.
export const AgentQuestionAnswerSchema = z.array(z.string().min(1).max(300)).max(6);

export type AgentQuestionOption = z.infer<typeof AgentQuestionOptionSchema>;
export type AgentQuestion = z.infer<typeof AgentQuestionSchema>;
export type AgentQuestionRequest = z.infer<typeof AgentQuestionRequestSchema>;
export type AgentQuestionAnswer = z.infer<typeof AgentQuestionAnswerSchema>;
