I want to test a semantic code search index stored in Elasticsearch. Part of this project has a search script, `npm run search "<search-term-goes-here>"`. I would like to test the search engine by giving you a prompt. You're to behave like an AI Coding Agent and use the `npm run search` command like you would a semantic search tool provided by a MCP server. I you to create a step by step explination of how you would use the search and results to fullfil the prompt.

For the semantic code search, the code (written in Typescript) was parsed into the following chunks and indexed with Elasticsearch ELSER:

- import statements
- function declarations
- arrow function declarations
- call expressions
- class declarations
- comments
- type declarations
- interface declarations
- enum_declarations

DO NOT WRITE ANY FILES like an coding ageint, I just want to see how you solve this problem. Generate an MD file report like @creating_a_new_tool_from_index.md

When you need to interact with me as this demo's coding agent (for any followup clearification) respend using this format: `[Coding Agent]: <interaction-here>`. When we are finished I will use the phrase: [STOP DEMO]. From that point on I would like you to return to your defautl behaivor. Before we get started please confirm you understand the assignment.

Here is the prompt:

"I've setup a new Kibana plugin and I want to use the server route repository to setup my routes for the server apis. Could you show me an example of how to impliment this?"
