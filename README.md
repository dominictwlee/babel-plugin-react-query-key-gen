# babel-plugin-react-query-string-key-gen

### Problem

React Query uses the convention of a string key as a unique, readable identifier for queries. However, naming things well is difficult.
Poor naming causes further confusion for the next person reading your code.

Also, query keys should include variables that your query function depends on. [Query function dependencies]https://react-query.tanstack.com/guides/query-keys#if-your-query-function-depends-on-a-variable-include-it-in-your-query-key. You will most likely be introducing stale data and bugs if you're not
following this advice.

### Solution

We could generate this key at build-time, inferring from the name of it's associated query function. Why name things twice when you can just
reuse what's already there? This babel plugin will statically analyze your code and extract the query function name from your `useQuery` hooks.

Secondly, given the recommendation of using inline functions in v3, we could look at which args are being passed to the nested queryFn call,
and fill in the missing keys according to that.

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

This plugin makes a few assumptions about your query key order and query function:

1. It expects your unique string key to always be the first element in your array key.
2. If you are using inline, anonymous query functions, it will try to infer the nestted query function name and args from your function scope.
3. If the name cannot be inferred and your unique string key is missing, a uuid will be generated for that query.
4. If all you need is a simple string key, you can pass an empty string or empty array to the queryKey param and a key will be generated for you.
5. Missing variables used in your nested queryFn will be added to your query keys.
6. The same rules apply if you are using queryObjects instead of parameters. QueryObjects are actually recommended because you can omit the queryKey entirely and let the plugin do its job at build-time.
