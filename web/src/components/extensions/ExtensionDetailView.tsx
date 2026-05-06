import { ExternalLink, ShieldCheck, Star } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ExtensionDetail } from '@/types';

export type InstalledExtensionAction = {
  applyLabel: string;
  onApply: () => void;
  active: boolean;
  onDeactivate: () => void;
  onDelete: () => void;
  deleting: boolean;
};

function formatDownloads(count: number) {
  return new Intl.NumberFormat('en-US').format(count);
}

function formatRelativeDate(date: string | null) {
  if (!date) return 'Unknown';
  const diffMs = Date.now() - new Date(date).getTime();
  const days = Math.max(1, Math.floor(diffMs / 86_400_000));
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(months / 12);
  return `${years} years ago`;
}

function MarkdownBlock({
  content,
  title,
}: {
  content: string | null;
  title?: string;
}) {
  if (!content) {
    return <p className="text-sm text-muted-foreground">No details available for this extension.</p>;
  }

  const normalizedTitle = title?.trim().toLowerCase() ?? '';
  const sanitizedContent = content.replace(/<!--[\s\S]*?-->/g, '');

  return (
    <div className="space-y-4 text-base leading-7 text-foreground/90">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          h1: ({ children }) => {
            const text = String(children).trim().toLowerCase();
            if (text === normalizedTitle) return null;
            return <h2 className="text-4xl font-semibold tracking-tight">{children}</h2>;
          },
          h2: ({ children }) => <h3 className="border-b pb-3 text-2xl font-semibold tracking-tight">{children}</h3>,
          h3: ({ children }) => <h4 className="text-xl font-semibold tracking-tight">{children}</h4>,
          p: ({ children }) => <p className="text-base leading-7 text-foreground/90">{children}</p>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-2">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-2">{children}</ol>,
          li: ({ children }) => <li className="text-base leading-7 text-foreground/90">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img
              src={src ?? ''}
              alt={alt ?? ''}
              className="my-6 max-w-full rounded-xl border object-contain"
            />
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-xl border bg-muted/30 p-4 font-mono text-sm">{children}</pre>
          ),
        }}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
}

type Props = {
  detail: ExtensionDetail;
  installing: boolean;
  canInstall: boolean;
  installedAction: InstalledExtensionAction | null;
  onInstall: () => void;
};

export function ExtensionDetailView({
  detail,
  installing,
  canInstall,
  installedAction,
  onInstall,
}: Props) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-6">
        <div className="flex items-start gap-6">
          {detail.extension.iconUrl ? (
            <img
              src={detail.extension.iconUrl}
              alt={detail.extension.displayName}
              className="h-28 w-28 rounded-2xl border border-border/70 object-cover"
            />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-border/70 bg-muted/20 text-5xl text-muted-foreground">
              ◫
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-4xl font-semibold tracking-tight">{detail.extension.displayName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-base text-muted-foreground">
              <span>{detail.extension.namespace}</span>
              {detail.extension.verified ? <ShieldCheck className="h-4 w-4 text-sky-400" /> : null}
              <span className="text-sky-400">{detail.extension.namespace.toLowerCase()}.com</span>
              <span>|</span>
              <span>{formatDownloads(detail.extension.downloadCount)}</span>
              {typeof detail.extension.averageRating === 'number' ? (
                <>
                  <span>|</span>
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {detail.extension.averageRating}
                  </span>
                </>
              ) : null}
            </div>
            <p className="mt-5 max-w-3xl text-xl leading-9 text-foreground/88">
              {detail.extension.description ?? 'No description provided.'}
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {installedAction ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={installedAction.onApply}
                      disabled={installedAction.active}
                      className="h-8 px-3 text-sm"
                    >
                      {installedAction.active ? 'Ativa' : installedAction.applyLabel}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={installedAction.onDeactivate}
                      disabled={!installedAction.active}
                      className="h-8 px-3 text-sm"
                    >
                      Desativar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={installedAction.onDelete}
                      disabled={installedAction.deleting}
                      className="h-8 px-3 text-sm"
                    >
                      {installedAction.deleting ? 'Excluindo...' : 'Excluir tema'}
                    </Button>
                  </>
                ) : null}
                {canInstall ? (
                  <Button
                    type="button"
                    className="h-8 bg-emerald-400 px-3 text-sm text-emerald-950 hover:bg-emerald-300"
                    onClick={onInstall}
                    disabled={installing}
                  >
                    {installing ? 'Instalando...' : 'Instalar extensão'}
                  </Button>
                ) : null}
                {!installedAction && !canInstall ? (
                  <Button type="button" variant="outline" disabled>
                    Extensão não suportada
                  </Button>
                ) : null}
                <label className="flex items-center gap-2 pl-1 text-sm text-muted-foreground">
                  <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-input bg-background" />
                  Auto Update
                </label>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/70 px-3 py-1.5">Instalar para usar no editor</span>
                <span className="rounded-full border border-border/70 px-3 py-1.5">Leia o resumo ou abra recursos externos abaixo</span>
                <span className="rounded-full border border-border/70 px-3 py-1.5">
                  {detail.resources.length} recurso{detail.resources.length === 1 ? '' : 's'} externo{detail.resources.length === 1 ? '' : 's'}
                </span>
              </div>
              {!installedAction && !canInstall ? (
                <p className="text-sm text-muted-foreground">
                  {detail.installSupport.reason ?? 'Esta extensão não pode ser instalada agora.'}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-7 flex gap-7 border-b border-border/60 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <button type="button" className="border-b-2 border-emerald-300 pb-3 text-foreground">Details</button>
          <button type="button" className="pb-3">Features</button>
          <button type="button" className="pb-3">Changelog</button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="grid min-h-full grid-cols-[minmax(0,1fr)_320px] gap-10 px-6 py-6">
          <div className="min-w-0 space-y-6">
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/[0.08] px-6 py-6">
              <MarkdownBlock content={detail.readme} title={detail.extension.displayName} />
            </div>
          </div>

          <aside className="border-l border-border/60 pl-8">
            <div className="space-y-7">
              <section>
                <h2 className="mb-4 text-[2rem] font-semibold tracking-tight">Marketplace</h2>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4 border-b border-border/40 py-1.5">
                    <dt className="text-muted-foreground">Identifier</dt>
                    <dd className="text-right">{detail.extension.namespace.toLowerCase()}.{detail.extension.name}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border/40 py-1.5">
                    <dt className="text-muted-foreground">Version</dt>
                    <dd>{detail.extension.version}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border/40 py-1.5">
                    <dt className="text-muted-foreground">Published</dt>
                    <dd>{formatRelativeDate(detail.publishedAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-b border-border/40 py-1.5">
                    <dt className="text-muted-foreground">Last Released</dt>
                    <dd>{formatRelativeDate(detail.updatedAt)}</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h2 className="mb-4 text-[2rem] font-semibold tracking-tight">Categories</h2>
                <div className="flex flex-wrap gap-2">
                  {detail.categories.length > 0 ? detail.categories.map((category) => (
                    <span key={category} className="rounded border border-border/70 px-2.5 py-1 text-xs">
                      {category}
                    </span>
                  )) : <span className="text-sm text-muted-foreground">None</span>}
                </div>
              </section>

              <section>
                <h2 className="mb-4 text-[2rem] font-semibold tracking-tight">Resources</h2>
                <div className="space-y-2">
                  {detail.resources.length > 0 ? detail.resources.map((resource) => (
                    <a
                      key={`${resource.label}-${resource.url}`}
                      href={resource.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-sm text-foreground hover:text-sky-400"
                    >
                      <ExternalLink className="h-4 w-4" />
                      {resource.label}
                    </a>
                  )) : <p className="text-sm text-muted-foreground">Nenhum recurso externo disponível.</p>}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </ScrollArea>
    </div>
  );
}
