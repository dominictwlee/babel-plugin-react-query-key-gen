import pluginTester from 'babel-plugin-tester';
import path from 'path';
import reactQueryStringKeyGenPlugin from '../index';

console.log(__dirname);

pluginTester({
  plugin: reactQueryStringKeyGenPlugin,
  pluginName: 'babel-plugin-react-query-string-key-gen',
  fixtures: path.join(__dirname, '__fixtures__'),
  tests: {
    'adds string key to the start of array queryKey': {
      code: `
        const { data } = useQuery([{id: 2}], () => getTodos());
      `,
      snapshot: true,
    },
    'ignores function calls that are not useQuery': {
      code: `
        const { data } = useSomethingElse([{id: 2}], () => getTodos());
        const { blah } = useQueryObject({queryFn: 'hello', queryKey: 'helloWorld', options: {}});
        callMe(1, 2, 3);
      `,
      snapshot: true,
    },
  },
});
