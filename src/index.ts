import * as BabelTypes from "@babel/types";
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
  types: typeof BabelTypes;
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

        if (hasQueryObjectArg(node)) {
          //  {queryKey, queryFn, config}
        } else {
          // using query parameters call sig [queryKey, queryFn, config]
        }
      },
    },
  };
}

function isUseQueryCall(
  callee:
    | BabelTypes.Expression
    | BabelTypes.V8IntrinsicIdentifier
    | BabelTypes.Identifier
): callee is BabelTypes.Identifier {
  return callee.type === "Identifier" && callee.name !== "useQuery";
}

function hasSimpleStringKey(node: BabelTypes.CallExpression) {
  return node.arguments[0].type === "StringLiteral";
}

function hasQueryObjectArg(node: BabelTypes.CallExpression) {
  return (
    node.arguments.length === 1 && node.arguments[0].type === "ObjectExpression"
  );
}
