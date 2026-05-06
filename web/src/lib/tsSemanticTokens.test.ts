import { describe, expect, it } from 'vitest';
import { encodeSemanticTokens } from './tsSemanticTokens';

function makeModel(text: string) {
  return {
    getPositionAt(offset: number) {
      const slice = text.slice(0, offset);
      const lines = slice.split('\n');
      return {
        lineNumber: lines.length,
        column: (lines.at(-1)?.length ?? 0) + 1,
      };
    },
  };
}

describe('encodeSemanticTokens', () => {
  it('encodes tokens in Monaco semantic format order', () => {
    const model = makeModel('class Foo {\n  bar(baz: Baz) {}\n}\n');

    const encoded = encodeSemanticTokens(model, [
      { start: 6, length: 3, tokenType: 'class', tokenModifiers: ['declaration'] },
      { start: 14, length: 3, tokenType: 'method', tokenModifiers: ['declaration'] },
      { start: 18, length: 3, tokenType: 'parameter', tokenModifiers: ['declaration'] },
      { start: 23, length: 3, tokenType: 'type' },
    ]);

    expect(Array.from(encoded)).toEqual([
      0, 6, 3, 1, 1,
      1, 2, 3, 7, 1,
      0, 3, 3, 9, 1,
      0, 4, 3, 3, 0,
    ]);
  });
});
