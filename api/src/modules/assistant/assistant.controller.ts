import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { AssistantAuthError, AssistantNotConfiguredError, AssistantTimeoutError, chatWithAssistant } from './assistant.service.ts';
import { ImageUploadNotConfiguredError, uploadCodexImage } from './image-upload.service.ts';

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});

const chatBodySchema = z.object({
  workspace: z.string().min(1),
  activePath: z.string().nullable().optional(),
  activeContent: z.string().nullable().optional(),
  imageUrls: z.array(z.string().url()).max(8).optional(),
  messages: z.array(chatMessageSchema).min(1),
});

const uploadReplySchema = z.object({
  ok: z.literal(true),
  url: z.string().url(),
  key: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().nonnegative(),
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

export async function postImageUpload(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user;
  if (!user) return reply.code(401).send({ error: 'unauthenticated' });
  if (!req.workspacePath) return reply.code(400).send({ error: 'workspace_required' });

  try {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'no_file' });
    if (!data.mimetype.startsWith('image/')) {
      return reply.code(400).send({ error: 'invalid_mime_type', message: 'Apenas imagens podem ser enviadas' });
    }

    const upload = await uploadCodexImage({
      buffer: await data.toBuffer(),
      filename: data.filename,
      mimeType: data.mimetype,
    });

    return reply.send(uploadReplySchema.parse({ ok: true, ...upload }));
  } catch (error) {
    if (error instanceof ImageUploadNotConfiguredError) {
      return reply.code(503).send({ error: 'image_upload_not_configured', message: error.message });
    }

    return reply.code(502).send({ error: 'image_upload_failed', message: (error as Error).message });
  }
}
