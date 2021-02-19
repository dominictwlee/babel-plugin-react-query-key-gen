import * as t from "@babel/types";
import { Visitor, NodePath } from "@babel/traverse";

export interface PluginOptions {
  opts?: {
    target?: string;
    runtime?: string;
  };
  file: {
    path: NodePath;
  };
}

export interface Babel {
  types: typeof t;
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
        if (!isUseQueryCall(node.callee) || hasSimpleStringKey(node)) {
          return;
        }

        if (hasQueryObjectArg(node.arguments)) {
          const queryObjExpression = node.arguments[0] as t.ObjectExpression;
          const queryKeyObjProperty = queryObjExpression.properties.find(
            (p) =>
              t.isObjectProperty(p) &&
              t.isIdentifier(p.key) &&
              p.key.name === "queryKey"
          ) as t.ObjectProperty;

          if (!queryKeyObjProperty) {
            const newQueryKeyProperty = t.objectProperty(
              t.identifier("queryKey"),
              t.stringLiteral("somethingNew")
            );
          }
        } else {
          // using query parameters call sig [queryKey, queryFn, config]
        }
      },
    },
  };
}

function isUseQueryCall(
  callee: t.Expression | t.V8IntrinsicIdentifier | t.Identifier
): callee is t.Identifier {
  return t.isIdentifier(callee) && callee.name !== "useQuery";
}

function hasSimpleStringKey(node: t.CallExpression) {
  return t.isStringLiteral(node.arguments[0]);
}

function hasQueryObjectArg(callExpressionArgs: t.CallExpression["arguments"]) {
  return (
    callExpressionArgs.length === 1 &&
    callExpressionArgs[0].type === "ObjectExpression"
  );
}
