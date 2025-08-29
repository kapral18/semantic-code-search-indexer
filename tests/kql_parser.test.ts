import { fromKueryExpression, toElasticsearchQuery } from '../libs/es-query';

describe('KQL Parser', () => {
  it('should parse a simple field query', () => {
    const kql = 'filePath: *parser*';
    const ast = fromKueryExpression(kql);
    const dsl = toElasticsearchQuery(ast);
    expect(dsl).toMatchSnapshot();
  });

  it('should parse a compound query with AND', () => {
    const kql = 'filePath: *parser* AND type: "code"';
    const ast = fromKueryExpression(kql);
    const dsl = toElasticsearchQuery(ast);
    expect(dsl).toMatchSnapshot();
  });

  it('should parse a nested query', () => {
    const kql = 'symbols: { name: "toElasticsearchQuery" }';
    const ast = fromKueryExpression(kql);
    const dsl = toElasticsearchQuery(ast);
    expect(dsl).toMatchSnapshot();
  });

  it('should parse a query with an OR condition', () => {
    const kql = 'language: typescript OR language: javascript';
    const ast = fromKueryExpression(kql);
    const dsl = toElasticsearchQuery(ast);
    expect(dsl).toMatchSnapshot();
  });

  it('should parse a query with a NOT condition', () => {
    const kql = 'NOT language: markdown';
    const ast = fromKueryExpression(kql);
    const dsl = toElasticsearchQuery(ast);
    expect(dsl).toMatchSnapshot();
  });

  it('should parse a query with a query string query and complex nesting', () => {
    const kql = '"addTool" AND (type: "code" OR kind: "function_definition")';
    const ast = fromKueryExpression(kql);
    const dsl = toElasticsearchQuery(ast);
    expect(dsl).toMatchSnapshot();
  });
});
