You are a new Gemini CLI session. Your goal is to assess the quality of the semantic code search index and the effectiveness of the provided MCP tools. You will perform a series of tasks, and then generate a report of your findings.

**Task 1: Verify Indexing Quality**

1.  Select three representative files from this project:
    *   `src/utils/parser.ts`
    *   `src/mcp_server/tools/read_file.ts`
    *   `src/utils/elasticsearch.ts`
2.  For each file, perform the following steps:
    *   Read the file content from the index using the `read_file_from_chunks` tool.
    *   Read the file content from disk using the `read_file` tool.
    *   Compare the two versions and provide a score (0-100) on how representative the chunked version is.
    *   Note any issues you find, such as duplication, missing information, or excessive noise.

**Task 2: Answer Complex Questions**

For each of the following prompts, use only the semantic code search MCP tools (`semantic_code_search`, `symbol_analysis`, `read_file_from_chunks`) to formulate an answer.

1.  **Prompt 1:** "How do you add a new tool to the MCP Server? Provide an example."
2.  **Prompt 2:** "How do I parse KQL to Elasticsearch query DSL in this project? Provide an example."
3.  **Prompt 3:** "How do I add a new language to this project? Provide an example."

For each prompt:
a.  Provide a confidence score (0-100) for your answer *before* you verify it.
b.  After you have formulated your answer, read the relevant files from disk to verify the correctness of your explanation and example.
c.  Rate the correctness of your answer (0-100).

**Task 3: Generate an Assessment Report**

1.  Based on your findings from the previous tasks, create a comprehensive assessment report. The report should be similar in structure and detail to the following example:

    ```markdown
    ### Overall Assessment

    This is a powerful and well-designed system for code understanding...

    ---

    ### 1. The Elasticsearch Index

    **Initial State Rating: 65/100**
    ...

    **Current State Rating: 95/100**
    ...

    ---

    ### 2. The MCP Tools

    The true strength of this system lies in the design of the MCP tools...

    *   **`semantic_code_search`:**
        *   **Assessment:** **Excellent (A+)**...

    *   **`symbol_analysis`:**
        *   **Assessment:** **Excellent (A)**...

    *   **`read_file_from_chunks`:**
        *   **Assessment:** **Very Good (A-)**...

    **Conclusion on Tools:**
    ...

    ---

    ### 3. Show Your Work

    #### Prompt 1: "How do you add a new tool to the MCP Server? Provide an example."

    *   **Tool Chain:**
        1.  `semantic_code_search`
        2.  `symbol_analysis`
        3.  `read_file_from_chunks`
    *   **Queries and Results:**
        *   **`semantic_code_search(query='...')`:**
            > snippet of relevant result...
        *   **`symbol_analysis(symbolName='...')`:**
            > snippet of relevant result...
        *   **`read_file_from_chunks(filePaths=['...'])`:**
            > snippet of relevant result...
    *   **Confidence Score:** ...
    *   **Correctness Score:** ...

    #### Prompt 2: ...
    ```

2.  Save the report as a new Markdown file in the `docs/assessments` directory. The filename should be the current date and time in the format `YYYY-MM-DD_HH-MM-SS.md`.
3.  Add a new section to the report titled "Recommendations for Improvement" and provide suggestions for improving the system.