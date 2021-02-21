# babel-plugin-react-query-string-key-gen

### Problem

Naming things well is difficult in programming. A poorly named thing could cause further confusion for the next person reading your code.
However, there is a fairly strong convention to include a string key as an identifier in the react-query query key.

### Solution

We could generate this key at build-time, inferring from the name of it's associated query function. Why name things twice when you can just
reuse what's already there? This babel plugin will statically analyze your code and extract the query function from your `useQuery` hooks.

### Installation

yarn:
`yarn add babel-plugin-react-query-string-key-gen --dev`

npm:
`npm install babel-plugin-react-query-string-key-gen --dev`

Then, add plugin to your `.babelrc`

```json
{
  "plugins": ["babel-plugin-react-query-string-key-gen"]
}
```

### Usage

You now have the option to exclude the string identifier from your query key if you want.
However, if you do choose to include a string key manually, then nothing will change.
This is to provide flexibility and ease of migration if you do decide to use this plugin.

This plugin makes a few assumptions about your query key order:

1. It expects your unique string key to always be the first element in your array key.
2. If you are using inline, anonymous query functions, it will try to infer the query function name from your function scope.
3. If the name cannot be inferred and your unique string key is missing, a uuid will be generated for that query.
4. If all you need is a simple string key, you can pass an empty string or empty array to the queryKey param and a key will be generated for you.
