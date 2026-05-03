export type GitDiffHighlightRanges = {
  original: Array<{ startLine: number; endLine: number }>;
  modified: Array<{ startLine: number; endLine: number }>;
  originalInline: Array<{ line: number; startColumn: number; endColumn: number }>;
  modifiedInline: Array<{ line: number; startColumn: number; endColumn: number }>;
};

function splitLines(content: string): string[] {
  return content.split('\n');
}

function buildLcsMatrix(original: string[], modified: string[]): number[][] {
  const rows = original.length + 1;
  const cols = modified.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let i = original.length - 1; i >= 0; i -= 1) {
    for (let j = modified.length - 1; j >= 0; j -= 1) {
      matrix[i][j] = original[i] === modified[j]
        ? matrix[i + 1][j + 1] + 1
        : Math.max(matrix[i + 1][j], matrix[i][j + 1]);
    }
  }

  return matrix;
}

function pushRange(ranges: Array<{ startLine: number; endLine: number }>, startLine: number, endLine: number) {
  if (endLine < startLine) return;
  ranges.push({ startLine, endLine });
}

function pushInlineRange(
  ranges: Array<{ line: number; startColumn: number; endColumn: number }>,
  line: number,
  startColumn: number,
  endColumn: number,
) {
  if (endColumn <= startColumn) return;
  ranges.push({ line, startColumn, endColumn });
}

function buildInlineRange(originalLine: string, modifiedLine: string) {
  const minLength = Math.min(originalLine.length, modifiedLine.length);
  let prefix = 0;
  while (prefix < minLength && originalLine[prefix] === modifiedLine[prefix]) {
    prefix += 1;
  }

  let originalSuffix = originalLine.length;
  let modifiedSuffix = modifiedLine.length;
  while (
    originalSuffix > prefix &&
    modifiedSuffix > prefix &&
    originalLine[originalSuffix - 1] === modifiedLine[modifiedSuffix - 1]
  ) {
    originalSuffix -= 1;
    modifiedSuffix -= 1;
  }

  return {
    original: {
      startColumn: prefix + 1,
      endColumn: originalSuffix + 1,
    },
    modified: {
      startColumn: prefix + 1,
      endColumn: modifiedSuffix + 1,
    },
  };
}

export function buildGitDiffHighlightRanges(originalContent: string, modifiedContent: string): GitDiffHighlightRanges {
  const original = splitLines(originalContent);
  const modified = splitLines(modifiedContent);
  const matrix = buildLcsMatrix(original, modified);
  const originalRanges: Array<{ startLine: number; endLine: number }> = [];
  const modifiedRanges: Array<{ startLine: number; endLine: number }> = [];
  const originalInline: Array<{ line: number; startColumn: number; endColumn: number }> = [];
  const modifiedInline: Array<{ line: number; startColumn: number; endColumn: number }> = [];

  let i = 0;
  let j = 0;

  while (i < original.length || j < modified.length) {
    if (i < original.length && j < modified.length && original[i] === modified[j]) {
      i += 1;
      j += 1;
      continue;
    }

    const originalStart = i;
    const modifiedStart = j;

    while (i < original.length || j < modified.length) {
      if (i < original.length && j < modified.length && original[i] === modified[j]) {
        break;
      }

      const down = i < original.length ? matrix[i + 1][j] : -1;
      const right = j < modified.length ? matrix[i][j + 1] : -1;

      if (j >= modified.length || (i < original.length && down >= right)) {
        i += 1;
      } else {
        j += 1;
      }
    }

    pushRange(originalRanges, originalStart + 1, i);
    pushRange(modifiedRanges, modifiedStart + 1, j);

    const originalCount = i - originalStart;
    const modifiedCount = j - modifiedStart;
    if (originalCount === 1 && modifiedCount === 1) {
      const inlineRange = buildInlineRange(original[originalStart], modified[modifiedStart]);
      pushInlineRange(originalInline, originalStart + 1, inlineRange.original.startColumn, inlineRange.original.endColumn);
      pushInlineRange(modifiedInline, modifiedStart + 1, inlineRange.modified.startColumn, inlineRange.modified.endColumn);
    }
  }

  return {
    original: originalRanges,
    modified: modifiedRanges,
    originalInline,
    modifiedInline,
  };
}
