import type { InstalledTheme } from '@/types';
import type { MonacoThemeRule } from '@/types';

function firstMatchingRule(
  rules: InstalledTheme['rules'],
  tokens: string[],
): InstalledTheme['rules'][number] | null {
  for (const token of tokens) {
    const match = rules.find((rule) => rule.token === token);
    if (match) return match;
  }

  return null;
}

function monacoCompatibilityRules(theme: InstalledTheme): InstalledTheme['rules'] {
  const rules = theme.rules;

  const typeIdentifierRule = firstMatchingRule(rules, [
    'entity.name.type',
    'entity.name.class',
    'support.class.builtin',
    'support.class.component.tsx',
    'support.class.dart',
  ]);
  const delimiterRule = firstMatchingRule(rules, [
    'punctuation.separator',
    'punctuation.definition.tag',
    'punctuation.section.embedded',
  ]);
  const bracketRule = firstMatchingRule(rules, [
    'punctuation.definition.template-expression.begin',
    'punctuation.definition.template-expression.end',
    'punctuation.quasi.element.begin',
    'punctuation.quasi.element.end',
  ]);
  const numberRule = firstMatchingRule(rules, [
    'constant',
    'constant.numeric',
    'string',
  ]);

  const compatibilityRules: Array<MonacoThemeRule | null> = [
    typeIdentifierRule
      ? { token: 'type.identifier', foreground: typeIdentifierRule.foreground, fontStyle: typeIdentifierRule.fontStyle }
      : null,
    delimiterRule
      ? { token: 'delimiter', foreground: delimiterRule.foreground, fontStyle: delimiterRule.fontStyle }
      : null,
    bracketRule
      ? { token: 'delimiter.bracket', foreground: bracketRule.foreground, fontStyle: bracketRule.fontStyle }
      : null,
    numberRule
      ? { token: 'number', foreground: numberRule.foreground, fontStyle: numberRule.fontStyle }
      : null,
    numberRule
      ? { token: 'number.float', foreground: numberRule.foreground, fontStyle: numberRule.fontStyle }
      : null,
    numberRule
      ? { token: 'number.hex', foreground: numberRule.foreground, fontStyle: numberRule.fontStyle }
      : null,
    numberRule
      ? { token: 'number.binary', foreground: numberRule.foreground, fontStyle: numberRule.fontStyle }
      : null,
    numberRule
      ? { token: 'number.octal', foreground: numberRule.foreground, fontStyle: numberRule.fontStyle }
      : null,
  ];

  return compatibilityRules.filter((rule): rule is MonacoThemeRule => rule !== null);
}

export function buildMonacoThemeData(theme: InstalledTheme) {
  return {
    base: theme.uiTheme,
    inherit: true,
    rules: [...theme.rules, ...(theme.semanticRules ?? []), ...monacoCompatibilityRules(theme)],
    colors: theme.colors,
  };
}

export function getMonacoThemeName(theme: InstalledTheme): string {
  const normalized = theme.id
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return `ext-${normalized || 'theme'}`;
}
