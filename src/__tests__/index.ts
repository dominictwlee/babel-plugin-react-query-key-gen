import pluginTester from 'babel-plugin-tester';
import path from 'path';
import reactQueryStringKeyGenPlugin from '../index';

jest.mock('nanoid');

pluginTester({
  plugin: reactQueryStringKeyGenPlugin,
  pluginName: 'babel-plugin-react-query-string-key-gen',
  fixtures: path.join(__dirname, '__fixtures__'),
  tests: {
    'adds string key to the start of array queryKey': {
      code: `
        useQuery([{id: 2}], () => getTodos());
      `,
      snapshot: true,
    },
    'Infer queryFn name from async/await function block': {
      code: `
        useQuery(
        [{param1: 'abc'}],
        async () => {
          const blah = 'hello';
          const someOtherStuff = calculate();
          const result = await batchGetProductSwapList(productNumbers, idToken);
          return result;
        },
        { enabled: true }
      );
      `,
      snapshot: true,
    },
    'Generate uuid key if queryFn name cannot be inferred': {
      code: `
        useQuery([{id: 2}], async () => [1, 2, id]);
        
        useQuery([], () => {
          return Promise.resolve('hello');
        });

        useQuery('', () => {
          return new Promise((res) => res('hello world'));
        });
      `,
      snapshot: true,
    },
    'ignores function calls that are not useQuery': {
      code: `
        useSomethingElse([{id: 2}], () => getTodos());
        useQueryObject({queryFn: 'hello', queryKey: 'helloWorld', options: {}});
        callMe(1, 2, 3);
      `,
      snapshot: true,
    },
    'adds missing queryFn args to array key in params function signature': {
      code: `
        useQuery([], () => fetchTodos(id));
      `,
      snapshot: true,
    },
  },
});
