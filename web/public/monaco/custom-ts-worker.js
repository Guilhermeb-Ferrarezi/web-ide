self.customTSWorkerFactory = function customTSWorkerFactory(BaseWorker, ts) {
  const declarationModifier = ['declaration'];

  function pushToken(tokens, seen, sourceFile, name, tokenType, tokenModifiers) {
    if (!name || typeof name.getStart !== 'function' || typeof name.getWidth !== 'function') return;

    const start = name.getStart(sourceFile);
    const length = name.getWidth(sourceFile);
    if (length <= 0) return;

    const key = `${start}:${length}:${tokenType}:${tokenModifiers.join('.')}`;
    if (seen.has(key)) return;
    seen.add(key);
    tokens.push({ start, length, tokenType, tokenModifiers });
  }

  function pushEntityName(tokens, seen, sourceFile, entityName, tokenType) {
    if (!entityName) return;

    if (ts.isIdentifier(entityName)) {
      pushToken(tokens, seen, sourceFile, entityName, tokenType, []);
      return;
    }

    if (typeof entityName.getStart !== 'function' || typeof entityName.getWidth !== 'function') return;
    const start = entityName.getStart(sourceFile);
    const length = entityName.getWidth(sourceFile);
    if (length <= 0) return;

    const key = `${start}:${length}:${tokenType}:`;
    if (seen.has(key)) return;
    seen.add(key);
    tokens.push({ start, length, tokenType, tokenModifiers: [] });
  }

  return class CustomTypeScriptWorker extends BaseWorker {
    async getDocumentSemanticTokens(fileName) {
      if (typeof this.isDefaultLibFileName === 'function' && this.isDefaultLibFileName(fileName)) {
        return [];
      }

      const program = this._languageService?.getProgram?.();
      const sourceFile = program?.getSourceFile(fileName);
      if (!program || !sourceFile) return [];

      const tokens = [];
      const seen = new Set();

      const visit = (node) => {
        if (ts.isClassDeclaration(node) && node.name) {
          pushToken(tokens, seen, sourceFile, node.name, 'class', declarationModifier);
        } else if (ts.isInterfaceDeclaration(node)) {
          pushToken(tokens, seen, sourceFile, node.name, 'interface', declarationModifier);
        } else if (ts.isTypeAliasDeclaration(node)) {
          pushToken(tokens, seen, sourceFile, node.name, 'type', declarationModifier);
        } else if (ts.isEnumDeclaration(node)) {
          pushToken(tokens, seen, sourceFile, node.name, 'enum', declarationModifier);
        } else if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
          pushToken(tokens, seen, sourceFile, node.name, 'namespace', declarationModifier);
        } else if (ts.isFunctionDeclaration(node) && node.name) {
          pushToken(tokens, seen, sourceFile, node.name, 'function', declarationModifier);
        } else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) {
          pushToken(tokens, seen, sourceFile, node.name, 'method', declarationModifier);
        } else if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) {
          pushToken(tokens, seen, sourceFile, node.name, 'property', declarationModifier);
        } else if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
          pushToken(tokens, seen, sourceFile, node.name, 'property', declarationModifier);
        } else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
          pushToken(tokens, seen, sourceFile, node.name, 'parameter', declarationModifier);
        } else if (ts.isTypeParameterDeclaration(node) && ts.isIdentifier(node.name)) {
          pushToken(tokens, seen, sourceFile, node.name, 'typeParameter', declarationModifier);
        } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
          pushToken(tokens, seen, sourceFile, node.name, 'variable', declarationModifier);
        } else if (ts.isBindingElement(node) && ts.isIdentifier(node.name)) {
          pushToken(tokens, seen, sourceFile, node.name, 'variable', declarationModifier);
        } else if (ts.isPropertyAccessExpression(node)) {
          const tokenType = node.parent && ts.isCallExpression(node.parent) && node.parent.expression === node ? 'method' : 'property';
          pushToken(tokens, seen, sourceFile, node.name, tokenType, []);
        } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          pushToken(tokens, seen, sourceFile, node.expression, 'function', []);
        } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) {
          pushToken(tokens, seen, sourceFile, node.expression, 'class', []);
        } else if (ts.isTypeReferenceNode(node)) {
          pushEntityName(tokens, seen, sourceFile, node.typeName, 'type');
        } else if (ts.isExpressionWithTypeArguments(node)) {
          pushEntityName(tokens, seen, sourceFile, node.expression, 'type');
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
      return tokens;
    }
  };
};
