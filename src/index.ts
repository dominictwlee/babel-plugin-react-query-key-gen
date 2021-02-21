import * as t from '@babel/types';
import { Visitor, NodePath } from '@babel/traverse';

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
  types: typeof t;
}

interface ParamsStringOnlyQueryKeySignature extends t.CallExpression {
  arguments: [t.StringLiteral, ...t.CallExpression['arguments']];
}

interface ParamsArrayKeySignature extends t.CallExpression {
  arguments: [t.ArrayExpression, ...t.CallExpression['arguments']];
}

interface QueryObjectSignature extends t.CallExpression {
  arguments: [t.ObjectExpression, ...t.CallExpression['arguments']];
}

export default function plugin(
  babel: Babel
): { name: string; visitor: Visitor<PluginOptions> } {
  const { types: t } = babel;
  return {
    name: 'babel-plugin-react-query-string-key-gen', // not required
    visitor: {
      CallExpression(path) {
        const { node } = path;
        if (!isUseQueryCall(node.callee) || hasStringOnlyQueryKeyParam(node)) {
          return;
        }

        // Handle params call signature
        if (hasParamsArrayKey(node)) {
          // ignore if string key already exists
          if (hasStringKeyParam(node)) {
            return;
          }

          const [arrayKey, queryFn] = node.arguments;
          let stringKeyLiteral: t.StringLiteral | null = null;

          if (t.isIdentifier(queryFn)) {
            stringKeyLiteral = t.stringLiteral(queryFn.name);
          } else if (t.isFunction(queryFn)) {
            stringKeyLiteral = extractQueryFnNameFromBody(queryFn);
          }

          if (stringKeyLiteral) {
            arrayKey.elements.unshift(stringKeyLiteral);
          }
        } else if (hasQueryObject(node)) {
          const queryObjExpression = node.arguments[0];
          const queryKeyProperty = queryObjExpression.properties.find(
            (p) =>
              t.isObjectProperty(p) &&
              t.isIdentifier(p.key) &&
              p.key.name === 'queryKey'
          ) as t.ObjectProperty;

          if (t.isStringLiteral(queryKeyProperty?.value)) {
            return;
          }

          const queryFnMember = queryObjExpression.properties.find(
            (p) =>
              t.isObjectMember(p) &&
              t.isIdentifier(p.key) &&
              p.key.name === 'queryFn'
          ) as t.ObjectMember;

          if (!queryFnMember) {
            return;
          }

          const queryFnName = t.isObjectMethod(queryFnMember)
            ? extractQueryFnNameFromBody(queryFnMember)
            : t.isFunction(queryFnMember.value)
            ? extractQueryFnNameFromBody(queryFnMember.value)
            : null;

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

function extractQueryFnNameFromBody(queryFn: t.Function) {
  // Get string key from call expression of anonymous arrow function body
  if (t.isCallExpression(queryFn.body) && t.isIdentifier(queryFn.body.callee)) {
    return t.stringLiteral(queryFn.body.callee.name);
  }

  // Get string key from named function expression
  if (t.isFunctionExpression(queryFn) && t.isIdentifier(queryFn.id)) {
    return t.stringLiteral(queryFn.id.name);
  }

  // attempt to infer queryFn name from block based on a few assumptions
  if (t.isBlockStatement(queryFn.body)) {
    const returnStatement = queryFn.body.body.find((bodyNode) =>
      t.isReturnStatement(bodyNode)
    ) as t.ReturnStatement | undefined;

    if (!returnStatement) {
      return null;
    }

    if (
      t.isCallExpression(returnStatement.argument) &&
      t.isIdentifier(returnStatement.argument.callee)
    ) {
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
      }) as t.VariableDeclaration | undefined;

      if (!variableDeclaration) {
        return null;
      }

      const { init } = variableDeclaration.declarations[0];

      if (t.isCallExpression(init) && t.isIdentifier(init.callee)) {
        return t.stringLiteral(init.callee.name);
      }

      if (
        t.isAwaitExpression(init) &&
        t.isCallExpression(init.argument) &&
        t.isIdentifier(init.argument.callee)
      ) {
        return t.stringLiteral(init.argument.callee.name);
      }
    }
  }

  return null;
}

function isUseQueryCall(
  callee: t.Expression | t.V8IntrinsicIdentifier | t.Identifier
): callee is t.Identifier {
  return t.isIdentifier(callee) && callee.name === 'useQuery';
}

function hasStringOnlyQueryKeyParam(
  node: t.CallExpression
): node is ParamsStringOnlyQueryKeySignature {
  return t.isStringLiteral(node.arguments[0]);
}

function hasParamsArrayKey(
  node: t.CallExpression
): node is ParamsArrayKeySignature {
  return t.isArrayExpression(node.arguments[0]);
}

function hasStringKeyParam(node: ParamsArrayKeySignature) {
  return t.isStringLiteral(node.arguments[0].elements[0]);
}

function hasQueryObject(node: t.CallExpression): node is QueryObjectSignature {
  return t.isObjectExpression(node.arguments[0]);
}
