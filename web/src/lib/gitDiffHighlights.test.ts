import { describe, expect, it } from 'vitest';
import { buildGitDiffHighlightRanges } from './gitDiffHighlights';

describe('buildGitDiffHighlightRanges', () => {
  it('marca linhas alteradas em ambos os lados', () => {
    const ranges = buildGitDiffHighlightRanges('a\nb\nc\n', 'a\nx\nc\n');

    expect(ranges.original).toEqual([{ startLine: 2, endLine: 2 }]);
    expect(ranges.modified).toEqual([{ startLine: 2, endLine: 2 }]);
  });

  it('marca adições só no lado modificado', () => {
    const ranges = buildGitDiffHighlightRanges('a\nc\n', 'a\nb\nc\n');

    expect(ranges.original).toEqual([]);
    expect(ranges.modified).toEqual([{ startLine: 2, endLine: 2 }]);
  });

  it('marca remoções só no lado original', () => {
    const ranges = buildGitDiffHighlightRanges('a\nb\nc\n', 'a\nc\n');

    expect(ranges.original).toEqual([{ startLine: 2, endLine: 2 }]);
    expect(ranges.modified).toEqual([]);
  });

  it('marca destaque intralinha quando uma linha muda parcialmente', () => {
    const ranges = buildGitDiffHighlightRanges('const value = 1;\n', 'const value = 2;\n');

    expect(ranges.originalInline).toEqual([
      { line: 1, startColumn: 15, endColumn: 16 },
    ]);
    expect(ranges.modifiedInline).toEqual([
      { line: 1, startColumn: 15, endColumn: 16 },
    ]);
  });

  it('marca sufixo intralinha quando há adição no fim da linha', () => {
    const ranges = buildGitDiffHighlightRanges('return value\n', 'return value.trim()\n');

    expect(ranges.originalInline).toEqual([]);
    expect(ranges.modifiedInline).toEqual([
      { line: 1, startColumn: 13, endColumn: 20 },
    ]);
  });
});
