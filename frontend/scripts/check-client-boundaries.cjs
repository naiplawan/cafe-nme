const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "src");
const options = {
  allowJs: true,
  jsx: ts.JsxEmit.Preserve,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  paths: { "@/*": ["./src/*"] },
  baseUrl: root,
};
const forbiddenSpecifiers = new Set([
  "next/cache",
  "next/headers",
  "server-only",
]);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:[cm]?[jt]sx?)$/.test(entry.name) ? [fullPath] : [];
  });
}

function collectDynamicImports(node, source, imports) {
  if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
    const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
    const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";
    if (isDynamicImport || isRequire) {
      imports.push({ specifier: node.arguments[0].text, position: node.arguments[0].getStart(source) });
    }
  }
  ts.forEachChild(node, (child) => collectDynamicImports(child, source, imports));
}

const files = sourceFiles(sourceRoot);
const parsedFiles = new Map();

for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const imports = [];
  let isClient = false;
  let isServerOnly = false;
  let isServerAction = false;

  for (const statement of source.statements) {
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
      if (statement.expression.text === "use client") isClient = true;
      if (statement.expression.text === "use server") isServerAction = true;
    }
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      if (specifier === "server-only") isServerOnly = true;
      const clause = statement.importClause;
      const namedBindings = clause?.namedBindings;
      const importsOnlyTypes = Boolean(
        clause && !clause.name && namedBindings && ts.isNamedImports(namedBindings) &&
        namedBindings.elements.length && namedBindings.elements.every((binding) => binding.isTypeOnly),
      );
      const typeOnly = Boolean(clause?.isTypeOnly || importsOnlyTypes);
      if (!typeOnly) imports.push({ specifier, position: statement.moduleSpecifier.getStart(source) });
    }
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
      if (!statement.isTypeOnly) {
        imports.push({ specifier: statement.moduleSpecifier.text, position: statement.moduleSpecifier.getStart(source) });
      }
    }
  }

  collectDynamicImports(source, source, imports);

  parsedFiles.set(file, { source, imports, isClient, isServerOnly, isServerAction });
}

function resolveImport(fromFile, specifier) {
  const resolved = ts.resolveModuleName(specifier, fromFile, options, ts.sys).resolvedModule;
  return resolved?.resolvedFileName;
}

const violations = new Set();

for (const [clientFile, client] of parsedFiles) {
  if (!client.isClient) continue;
  const visited = new Set();
  const stack = [{ file: clientFile, entry: clientFile }];

  while (stack.length) {
    const current = stack.pop();
    if (!current || visited.has(current.file)) continue;
    visited.add(current.file);
    const parsed = parsedFiles.get(current.file);
    if (!parsed) continue;
    if (parsed.isServerAction) continue;

    if (current.file !== clientFile && parsed.isServerOnly) {
      violations.add(`${path.relative(root, clientFile)} imports server-only module ${path.relative(root, current.file)}`);
    }

    for (const imported of parsed.imports) {
      if (forbiddenSpecifiers.has(imported.specifier)) {
        const { line } = parsed.source.getLineAndCharacterOfPosition(imported.position);
        violations.add(`${path.relative(root, current.file)}:${line + 1} imports forbidden module "${imported.specifier}" (client entry: ${path.relative(root, clientFile)})`);
        continue;
      }
      const resolved = resolveImport(current.file, imported.specifier);
      if (resolved && parsedFiles.has(resolved)) stack.push({ file: resolved, entry: clientFile });
    }
  }
}

if (violations.size) {
  console.error("Client/server import boundary violations:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log(`Client/server import boundaries pass (${[...parsedFiles.values()].filter((file) => file.isClient).length} client entry points checked).`);
}
