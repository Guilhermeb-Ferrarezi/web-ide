const MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  mjs: 'javascript', cjs: 'javascript', json: 'json', md: 'markdown', mdx: 'markdown',
  css: 'css', scss: 'scss', less: 'less', html: 'html', xml: 'xml', svg: 'xml',
  yaml: 'yaml', yml: 'yaml', toml: 'ini', sh: 'shell', bash: 'shell',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java', kt: 'kotlin',
  c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', sql: 'sql', graphql: 'graphql', gql: 'graphql',
  vue: 'html', svelte: 'html', dockerfile: 'dockerfile', env: 'ini',
};

export function detectLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  const ext = lower.split('.').pop();
  return (ext && MAP[ext]) || 'plaintext';
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
