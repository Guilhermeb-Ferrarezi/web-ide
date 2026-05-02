import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AssistantAuthError, AssistantNotConfiguredError, AssistantTimeoutError, chatWithAssistant } from './assistant.service.ts';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

const chatBodySchema = z.object({
  workspace: z.string().min(1),
  activePath: z.string().nullable().optional(),
  activeContent: z.string().nullable().optional(),
  messages: z.array(chatMessageSchema).min(1),
});

export function createPostChat(
  assistantChat = chatWithAssistant,
): (req: FastifyRequest, reply: FastifyReply) => Promise<unknown> {
  return async function postChat(req: FastifyRequest, reply: FastifyReply) {
    const user = req.session.user;
    if (!user) return reply.code(401).send({ error: 'unauthenticated' });

    try {
      const body = chatBodySchema.parse(req.body);
      if (!req.workspacePath) {
        return reply.code(400).send({ error: 'workspace_required' });
      }

      return reply.send(
        await assistantChat({
          ...body,
          workspacePath: req.workspacePath,
        }),
      );
    } catch (error) {
      if (error instanceof AssistantNotConfiguredError) {
        return reply.code(503).send({ error: 'assistant_not_configured', message: error.message });
      }

      if (error instanceof AssistantTimeoutError) {
        return reply.code(504).send({ error: 'assistant_timeout', message: error.message });
      }

      if (error instanceof AssistantAuthError) {
        return reply.code(503).send({ error: 'assistant_codex_login_required', message: error.message });
      }

      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'invalid_chat_payload', message: error.message });
      }

      return reply.code(502).send({ error: 'assistant_chat_failed', message: (error as Error).message });
    }
  };
}

export const postChat = createPostChat();
