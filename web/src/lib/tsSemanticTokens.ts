export const TS_SEMANTIC_TOKEN_TYPES = [
  'namespace',
  'class',
  'interface',
  'type',
  'enum',
  'typeParameter',
  'function',
  'method',
  'property',
  'parameter',
  'variable',
] as const;

export const TS_SEMANTIC_TOKEN_MODIFIERS = ['declaration'] as const;

export type TypeScriptSemanticTokenType = (typeof TS_SEMANTIC_TOKEN_TYPES)[number];
export type TypeScriptSemanticTokenModifier = (typeof TS_SEMANTIC_TOKEN_MODIFIERS)[number];

export type TypeScriptSemanticToken = {
  start: number;
  length: number;
  tokenType: TypeScriptSemanticTokenType;
  tokenModifiers?: TypeScriptSemanticTokenModifier[];
};

const TOKEN_TYPE_INDEX = new Map(TS_SEMANTIC_TOKEN_TYPES.map((tokenType, index) => [tokenType, index]));
const TOKEN_MODIFIER_INDEX = new Map(TS_SEMANTIC_TOKEN_MODIFIERS.map((modifier, index) => [modifier, index]));

export const TS_SEMANTIC_TOKEN_LEGEND = {
  tokenTypes: [...TS_SEMANTIC_TOKEN_TYPES],
  tokenModifiers: [...TS_SEMANTIC_TOKEN_MODIFIERS],
};

type PositionLike = {
  lineNumber: number;
  column: number;
};

type OffsetModel = {
  getPositionAt(offset: number): PositionLike;
  getVersionId(): number;
  uri: { toString(): string };
};

type SemanticTokensProviderModel = {
  getPositionAt(offset: number): PositionLike;
  getVersionId(): number;
  uri: { toString(): string };
};

type ExtendedTypeScriptWorker = {
  getDocumentSemanticTokens?: (fileName: string) => Promise<TypeScriptSemanticToken[]>;
};

type WorkerAccessor = (...uris: unknown[]) => Promise<ExtendedTypeScriptWorker>;

type MonacoLike = {
  languages: {
    registerDocumentSemanticTokensProvider: (
      languageId: string,
      provider: {
        getLegend(): typeof TS_SEMANTIC_TOKEN_LEGEND;
        provideDocumentSemanticTokens(model: SemanticTokensProviderModel): Promise<{ resultId: string; data: Uint32Array }>;
        releaseDocumentSemanticTokens(resultId?: string): void;
      },
    ) => unknown;
    typescript: {
      getTypeScriptWorker(): Promise<WorkerAccessor>;
      getJavaScriptWorker(): Promise<WorkerAccessor>;
      typescriptDefaults: { setWorkerOptions(options: { customWorkerPath?: string }): void };
      javascriptDefaults: { setWorkerOptions(options: { customWorkerPath?: string }): void };
    };
  };
};

function compareTokens(a: TypeScriptSemanticToken, b: TypeScriptSemanticToken) {
  if (a.start !== b.start) return a.start - b.start;
  if (a.length !== b.length) return a.length - b.length;
  return a.tokenType.localeCompare(b.tokenType);
}

function encodeTokenModifiers(modifiers: TypeScriptSemanticTokenModifier[] | undefined): number {
  if (!modifiers || modifiers.length === 0) return 0;

  return modifiers.reduce((bitset, modifier) => {
    const index = TOKEN_MODIFIER_INDEX.get(modifier);
    return typeof index === 'number' ? bitset | (1 << index) : bitset;
  }, 0);
}

export function encodeSemanticTokens(model: Pick<OffsetModel, 'getPositionAt'>, tokens: TypeScriptSemanticToken[]): Uint32Array {
  const encoded: number[] = [];
  const sortedTokens = [...tokens]
    .filter((token) => token.length > 0 && TOKEN_TYPE_INDEX.has(token.tokenType))
    .sort(compareTokens);

  let previousPosition: PositionLike | null = null;

  for (const token of sortedTokens) {
    const tokenType = TOKEN_TYPE_INDEX.get(token.tokenType);
    if (typeof tokenType !== 'number') continue;

    const position = model.getPositionAt(token.start);
    const deltaLine = previousPosition ? position.lineNumber - previousPosition.lineNumber : position.lineNumber - 1;
    const deltaStart = previousPosition && deltaLine === 0
      ? position.column - previousPosition.column - 1
      : position.column - 1;

    encoded.push(
      deltaLine,
      deltaStart,
      token.length,
      tokenType,
      encodeTokenModifiers(token.tokenModifiers),
    );

    previousPosition = position;
  }

  return Uint32Array.from(encoded);
}

let configured = false;

function registerSemanticTokensProvider(
  monaco: MonacoLike,
  languageId: 'typescript' | 'javascript',
  getWorkerAccessor: () => Promise<WorkerAccessor>,
) {
  return monaco.languages.registerDocumentSemanticTokensProvider(languageId, {
    getLegend() {
      return TS_SEMANTIC_TOKEN_LEGEND;
    },
    async provideDocumentSemanticTokens(model: SemanticTokensProviderModel) {
      const workerAccessor = await getWorkerAccessor();
      const worker = await workerAccessor(model.uri);
      const tokens = await worker.getDocumentSemanticTokens?.(model.uri.toString());

      return {
        resultId: `${model.uri.toString()}:${model.getVersionId()}`,
        data: encodeSemanticTokens(model, tokens ?? []),
      };
    },
    releaseDocumentSemanticTokens() {},
  });
}

export function configureTypeScriptSemanticTokens(monacoInput: unknown) {
  const monaco = monacoInput as MonacoLike;

  monaco.languages.typescript.typescriptDefaults.setWorkerOptions({
    customWorkerPath: '/monaco/custom-ts-worker.js',
  });
  monaco.languages.typescript.javascriptDefaults.setWorkerOptions({
    customWorkerPath: '/monaco/custom-ts-worker.js',
  });

  if (configured) return;
  configured = true;

  registerSemanticTokensProvider(monaco, 'typescript', () => monaco.languages.typescript.getTypeScriptWorker());
  registerSemanticTokensProvider(monaco, 'javascript', () => monaco.languages.typescript.getJavaScriptWorker());
}
