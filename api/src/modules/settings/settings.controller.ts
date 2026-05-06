import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getUserSettings, saveUserSetting, type UserSettingsKey } from './settings.service.ts';

const settingKeySchema = z.enum(['appearance', 'editor', 'layout', 'search', 'assistant']);

const appearanceSchema = z.object({
  activeThemeId: z.string().min(1),
  activeIconThemeId: z.string().min(1),
});

const editorSchema = z.object({
  wordWrap: z.boolean(),
  autoSaveMode: z.enum(['off', 'afterDelay']),
  autoSaveDelayMs: z.number().int().positive(),
  fontSize: z.number().int().min(10).max(24),
});

const layoutSchema = z.object({
  sidePanel: z.enum(['files', 'search', 'git', 'extensions']),
});

const searchSchema = z.object({
  caseSensitive: z.boolean().optional(),
  wholeWord: z.boolean().optional(),
  regex: z.boolean().optional(),
});

const assistantMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const assistantSchema = z.object({
  draft: z.string(),
  messages: z.array(assistantMessageSchema),
});

function parseValue(settingKey: UserSettingsKey, body: unknown) {
  switch (settingKey) {
    case 'appearance':
      return appearanceSchema.parse(body);
    case 'editor':
      return editorSchema.parse(body);
    case 'layout':
      return layoutSchema.parse(body);
    case 'search':
      return searchSchema.parse(body);
    case 'assistant':
      return assistantSchema.parse(body);
  }
}

export async function getSettings(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user;
  if (!user) return reply.code(401).send({ error: 'unauthenticated' });
  return reply.send(await getUserSettings(user.userId));
}

export async function putSetting(req: FastifyRequest, reply: FastifyReply) {
  const user = req.session.user;
  if (!user) return reply.code(401).send({ error: 'unauthenticated' });

  const params = z.object({ key: settingKeySchema }).parse(req.params);
  const value = parseValue(params.key, req.body);
  await saveUserSetting(user.userId, params.key, value);
  return reply.code(204).send();
}
