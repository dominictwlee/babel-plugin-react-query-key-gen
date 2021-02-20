import * as t from "@babel/types";
import { Visitor, NodePath } from "@babel/traverse";

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
  arguments: [t.StringLiteral, ...t.CallExpression["arguments"]];
}

interface ParamsArrayKeySignature extends t.CallExpression {
  arguments: [t.ArrayExpression, ...t.CallExpression["arguments"]];
}

interface QueryObjectSignature extends t.CallExpression {
  arguments: [t.ObjectExpression, ...t.CallExpression["arguments"]];
}

export default function plugin(
  babel: Babel
): { name: string; visitor: Visitor<PluginOptions> } {
  const { types: t } = babel;

  return {
    name: "ast-transform", // not required
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

          // infer string key from function name and add to existing params key
          if (t.isIdentifier(queryFn)) {
            stringKeyLiteral = t.stringLiteral(queryFn.name);
          } else if (t.isFunction(queryFn)) {
            stringKeyLiteral = extractQueryFnNameFromBody(queryFn);
          }

          if (stringKeyLiteral) {
            arrayKey.elements.unshift(stringKeyLiteral);
          }
        }

        // if (hasQueryObjectArg(node.arguments)) {
        //   const queryObjExpression = node.arguments[0] as t.ObjectExpression;
        //   const queryKeyObjProperty = queryObjExpression.properties.find(
        //     (p) =>
        //       t.isObjectProperty(p) &&
        //       t.isIdentifier(p.key) &&
        //       p.key.name === "queryKey"
        //   ) as t.ObjectProperty;

        //   if (!queryKeyObjProperty) {
        //     const newQueryKeyProperty = t.objectProperty(
        //       t.identifier("queryKey"),
        //       t.stringLiteral("somethingNew")
        //     );
        //   }
        // } else {
        //   // using query parameters call sig [queryKey, queryFn, config]
        // }
      },
    },
  };
}

function extractQueryFnNameFromBody(queryFn: t.Function) {
  if (t.isBlockStatement(queryFn.body)) {
    const returnStatement = queryFn.body.body.find((statement) =>
      t.isReturnStatement(statement)
    ) as t.ReturnStatement | undefined;

    if (
      returnStatement &&
      t.isCallExpression(returnStatement.argument) &&
      t.isIdentifier(returnStatement.argument.callee)
    ) {
      return t.stringLiteral(returnStatement.argument.callee.name);
    }
  } else if (t.isCallExpression(queryFn.body)) {
    if (t.isIdentifier(queryFn.body.callee)) {
      return t.stringLiteral(queryFn.body.callee.name);
    }
  }

  return null;
}

function isUseQueryCall(
  callee: t.Expression | t.V8IntrinsicIdentifier | t.Identifier
): callee is t.Identifier {
  return t.isIdentifier(callee) && callee.name === "useQuery";
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

// function hasQueryObject(node: t.CallExpression) {
//   return (
//     callExpressionArgs.length === 1 &&
//     callExpressionArgs[0].type === "ObjectExpression"
//   );
// }
