import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import path from 'node:path';
import { collectTypeDefs, deletePath, makeDir, readFile, readTree, renamePath, searchFiles, uploadFile, writeFile } from './fs.service.ts';

const pathSchema = z.string().min(1).max(1024);
const fileQuerySchema = z.object({
  workspace: z.string(),
  path: pathSchema,
});

export async function getTree(req: FastifyRequest, reply: FastifyReply) {
  const tree = await readTree(req.workspacePath!);
  return reply.send(tree);
}

const boolFlag = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .optional()
  .transform((value) => value === true || value === 'true' || value === '1');

const searchQuerySchema = z.object({
  workspace: z.string(),
  query: z.string().trim().min(1).max(200),
  caseSensitive: boolFlag,
  wholeWord: boolFlag,
  regex: boolFlag,
});

export async function getSearch(req: FastifyRequest, reply: FastifyReply) {
  const query = searchQuerySchema.parse(req.query);
  const results = await searchFiles(req.workspacePath!, query.query, {
    caseSensitive: query.caseSensitive,
    wholeWord: query.wholeWord,
    regex: query.regex,
  });
  return reply.send(results);
}

export async function getFile(req: FastifyRequest, reply: FastifyReply) {
  const query = fileQuerySchema.parse(req.query);
  const file = await readFile(req.workspacePath!, query.path);
  return reply.send(file);
}

const writeSchema = z.object({
  workspace: z.string(),
  path: pathSchema,
  content: z.string(),
  encoding: z.enum(['utf-8', 'base64']).default('utf-8'),
});

export async function putFile(req: FastifyRequest, reply: FastifyReply) {
  const body = writeSchema.parse(req.body);
  await writeFile(req.workspacePath!, body.path, body.content, body.encoding);
  return reply.send({ ok: true });
}

export async function deleteFile(req: FastifyRequest, reply: FastifyReply) {
  const query = fileQuerySchema.parse(req.query);
  await deletePath(req.workspacePath!, query.path);
  return reply.code(204).send();
}

const mkdirSchema = z.object({ workspace: z.string(), path: pathSchema });
export async function postMkdir(req: FastifyRequest, reply: FastifyReply) {
  const body = mkdirSchema.parse(req.body);
  await makeDir(req.workspacePath!, body.path);
  return reply.code(201).send({ ok: true });
}

const renameSchema = z.object({ workspace: z.string(), from: pathSchema, to: pathSchema });
export async function postRename(req: FastifyRequest, reply: FastifyReply) {
  const body = renameSchema.parse(req.body);
  await renamePath(req.workspacePath!, body.from, body.to);
  return reply.send({ ok: true });
}

export async function getTypes(req: FastifyRequest, reply: FastifyReply) {
  const types = await collectTypeDefs(req.workspacePath!);
  return reply.send(types);
}

export async function postUpload(req: FastifyRequest, reply: FastifyReply) {
  const data = await req.file();
  if (!data) return reply.code(400).send({ error: 'no_file' });
  const target = (data.fields.path as any)?.value ?? data.filename;
  if (!target) return reply.code(400).send({ error: 'path_required' });
  const buf = await data.toBuffer();
  await uploadFile(req.workspacePath!, path.posix.normalize(target), buf);
  return reply.code(201).send({ ok: true, path: target });
}
