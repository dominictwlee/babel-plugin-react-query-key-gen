import * as babelTypes from '@babel/types';
import { nanoid } from 'nanoid';
import { Visitor, NodePath } from '@babel/traverse';
import type {
  CallExpression,
  Expression,
  Identifier,
  ReturnStatement,
  SpreadElement,
  V8IntrinsicIdentifier,
  VariableDeclaration,
  Function,
  StringLiteral,
  ArrayExpression,
  ObjectExpression,
  ObjectProperty,
  ObjectMember,
} from '@babel/types';

interface PluginOptions {
  opts?: {
    target?: string;
    runtime?: string;
  };
  file: {
    path: NodePath;
  };
}

interface Babel {
  types: typeof babelTypes;
}

interface ParamsStringOnlyQueryKeySignature extends CallExpression {
  arguments: [StringLiteral, ...CallExpression['arguments']];
}

interface ArrayKeyWithString extends ArrayExpression {
  elements: [StringLiteral, ...(null | Expression | SpreadElement)[]];
}

interface ParamsArrayKeySignature extends CallExpression {
  arguments: [ArrayKeyWithString, ...CallExpression['arguments']];
}

interface QueryObjectSignature extends CallExpression {
  arguments: [ObjectExpression, ...CallExpression['arguments']];
}

interface CallExpressionWithIdentifier extends CallExpression {
  callee: Identifier;
}

export default function plugin(
  babel: Babel
): { name: string; visitor: Visitor<PluginOptions> } {
  const { types: t } = babel;
  return {
    name: 'babel-plugin-react-query-string-key-gen',
    visitor: {
      CallExpression(path) {
        const { node } = path;
        if (!isUseQueryCall(t, node.callee)) {
          return;
        }

        const stringKeyLiteral =
          extractParamsQueryFnName(t, node) ?? createUuidStringLiteral(t);

        if (hasStringOnlyQueryKey(t, node)) {
          if (node.arguments[0].value === '') {
            node.arguments[0] = stringKeyLiteral;
          } else {
            node.arguments.unshift(stringKeyLiteral);
          }
          return;
        }

        if (hasArrayKeyArg(t, node)) {
          let [arrayKey] = node.arguments;

          if (!hasFirstElStringKey(t, node)) {
            if (t.isStringLiteral(arrayKey.elements[0])) {
              arrayKey.elements[0].value = stringKeyLiteral.value;
            } else {
              arrayKey.elements.unshift(stringKeyLiteral);
            }
          }

          if (!t.isFunction(node.arguments[1])) {
            return;
          }

          const queryFnWrapper = node.arguments[1];
          const additionalKeyEls = arrayKey.elements.slice(1);
          const queryFnArgs = extractQueryFnArgs(t, queryFnWrapper);
          const missingKeys = queryFnArgs.filter(
            (fnArg) =>
              additionalKeyEls.findIndex((keyEl) => {
                if (t.isIdentifier(fnArg) && t.isIdentifier(keyEl)) {
                  return fnArg.name === keyEl.name;
                }

                return false;
              }) > -1
          ) as babelTypes.Identifier[];

          arrayKey.elements = [...arrayKey.elements, ...missingKeys];
          return;
        }

        if (hasQueryObject(t, node)) {
          const queryObjExpression = node.arguments[0];
          const queryKeyProperty = queryObjExpression.properties.find(
            (p) =>
              t.isObjectProperty(p) &&
              t.isIdentifier(p.key) &&
              p.key.name === 'queryKey'
          ) as ObjectProperty;

          if (t.isStringLiteral(queryKeyProperty?.value)) {
            return;
          }

          const queryFnMember = queryObjExpression.properties.find(
            (p) =>
              t.isObjectMember(p) &&
              t.isIdentifier(p.key) &&
              p.key.name === 'queryFn'
          ) as ObjectMember;

          if (!queryFnMember) {
            return;
          }

          const queryFnName = t.isObjectMethod(queryFnMember)
            ? extractQueryFnNameFromBody(t, queryFnMember)
            : t.isFunction(queryFnMember.value)
            ? extractQueryFnNameFromBody(t, queryFnMember.value)
            : t.stringLiteral(nanoid(10));

          if (!queryFnName) {
            return;
          }

          if (!queryKeyProperty) {
            queryObjExpression.properties.push(
              t.objectProperty(t.identifier('queryKey'), queryFnName)
            );
          } else {
            if (
              t.isArrayExpression(queryKeyProperty.value) &&
              !t.isStringLiteral(queryKeyProperty.value.elements[0])
            ) {
              queryKeyProperty.value.elements.unshift(queryFnName);
            }
          }
        }
      },
    },
  };
}

function extractParamsQueryFnName(
  t: Babel['types'],
  node: babelTypes.CallExpression
) {
  const [, queryFn] = node.arguments;
  let stringKeyLiteral: StringLiteral | null = null;

  if (t.isIdentifier(queryFn)) {
    stringKeyLiteral = t.stringLiteral(queryFn.name);
  } else if (t.isFunction(queryFn)) {
    stringKeyLiteral = extractQueryFnNameFromBody(t, queryFn);
  }

  return stringKeyLiteral;
}

function extractQueryFnArgs(t: Babel['types'], queryFn: Function) {
  if (t.isCallExpression(queryFn.body)) {
    return queryFn.body.arguments;
  }

  if (t.isBlockStatement(queryFn.body)) {
    return findNestedQueryFn(t, queryFn.body)?.arguments ?? [];
  }

  return [];
}

function extractQueryFnNameFromBody(t: Babel['types'], queryFn: Function) {
  // Get string key from call expression of anonymous arrow function body
  if (hasCalleeName(t, queryFn.body)) {
    return t.stringLiteral(queryFn.body.callee.name);
  }

  // Get string key from named function expression
  if (t.isFunctionExpression(queryFn) && t.isIdentifier(queryFn.id)) {
    return t.stringLiteral(queryFn.id.name);
  }

  /**
   * attempt to infer queryFn name from block based on a few assumptions
   * 1. The query function is named
   * 2. The query function is called within the block.
   * 3. The resulting value of the invoked query function within the block will be returned
   *  */
  if (t.isBlockStatement(queryFn.body)) {
    const returnStatement = queryFn.body.body.find((bodyNode) =>
      t.isReturnStatement(bodyNode)
    ) as ReturnStatement | undefined;

    if (!returnStatement) {
      return null;
    }

    if (hasCalleeName(t, returnStatement.argument)) {
      return t.stringLiteral(returnStatement.argument.callee.name);
    }

    // Find variable that holds result of queryFn call
    if (t.isIdentifier(returnStatement.argument)) {
      const { name } = returnStatement.argument;
      const variableDeclaration = queryFn.body.body.find((bodyNode) => {
        if (!t.isVariableDeclaration(bodyNode)) {
          return false;
        }

        if (
          t.isVariableDeclarator(bodyNode.declarations[0]) &&
          t.isIdentifier(bodyNode.declarations[0].id)
        ) {
          return bodyNode.declarations[0].id.name === name;
        }

        return false;
      }) as VariableDeclaration | undefined;

      if (!variableDeclaration) {
        return null;
      }

      const { init } = variableDeclaration.declarations[0];

      if (hasCalleeName(t, init)) {
        return t.stringLiteral(init.callee.name);
      }

      if (t.isAwaitExpression(init) && hasCalleeName(t, init.argument)) {
        return t.stringLiteral(init.argument.callee.name);
      }
    }
  }

  return null;
}

function findNestedQueryFn(
  t: Babel['types'],
  block: babelTypes.BlockStatement
) {
  const returnStatement = findReturnStatement(t, block);
  if (!returnStatement) {
    return null;
  }

  if (t.isCallExpression(returnStatement.argument)) {
    return returnStatement.argument;
  }

  /**
   * Find variable that holds result of queryFn call.
   * A fairly naive implementation that only handles simple cases like:
   *
   *
   * async () => {
   *  const result = await fetchData(a, b);
   *   return result;
   * }
   *
   * () => {
   *   const result = fetchData(productNumbers, idToken);
   *   return result;
   * }
   *
   * This is just to cover the grounds for the assumption that the anonymous function
   * serves as a basic wrapper for the nested queryFn to access variables in its closure.
   *
   * Not entirely sure how to reliably extract nested queryFn information with blocks that have complex
   * logic in it yet.
   *  */
  if (t.isIdentifier(returnStatement.argument)) {
    const { name } = returnStatement.argument;
    const variableDeclaration = block.body.find((bodyNode) => {
      if (!t.isVariableDeclaration(bodyNode)) {
        return false;
      }

      if (
        t.isVariableDeclarator(bodyNode.declarations[0]) &&
        t.isIdentifier(bodyNode.declarations[0].id)
      ) {
        return bodyNode.declarations[0].id.name === name;
      }

      return false;
    }) as VariableDeclaration | undefined;

    if (!variableDeclaration) {
      return null;
    }

    const { init } = variableDeclaration.declarations[0];
    let queryFn: babelTypes.CallExpression | null = null;
    t.traverseFast(init, (node) => {
      if (t.isCallExpression(node)) {
        queryFn = node;
      }
    });

    return queryFn;
  }

  return null;
}

function findReturnStatement(
  t: Babel['types'],
  block: babelTypes.BlockStatement
) {
  return block.body.find((bodyNode) => t.isReturnStatement(bodyNode)) as
    | babelTypes.ReturnStatement
    | undefined;
}

function hasCalleeName(
  t: Babel['types'],
  node: object | null | undefined
): node is CallExpressionWithIdentifier {
  return !!(
    t.isCallExpression(node) &&
    t.isIdentifier(node.callee) &&
    node.callee.name
  );
}

function isUseQueryCall(
  t: Babel['types'],
  callee: Expression | V8IntrinsicIdentifier | Identifier
): callee is Identifier {
  return t.isIdentifier(callee) && callee.name === 'useQuery';
}

function hasStringOnlyQueryKey(
  t: Babel['types'],
  node: CallExpression
): node is ParamsStringOnlyQueryKeySignature {
  return t.isStringLiteral(node.arguments[0]);
}

function hasArrayKeyArg(
  t: Babel['types'],
  node: CallExpression
): node is ParamsArrayKeySignature {
  return t.isArrayExpression(node.arguments[0]);
}

function hasFirstElStringKey(t: Babel['types'], node: ParamsArrayKeySignature) {
  return (
    t.isStringLiteral(node.arguments[0].elements[0]) &&
    node.arguments[0].elements[0].value !== ''
  );
}

function hasQueryObject(
  t: Babel['types'],
  node: CallExpression
): node is QueryObjectSignature {
  return t.isObjectExpression(node.arguments[0]);
}

function createUuidStringLiteral(t: Babel['types'], size: number = 10) {
  return t.stringLiteral(nanoid(size));
}
