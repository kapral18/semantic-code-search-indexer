# Code Indexer

This project is a TypeScript-based code indexer that uses Tree-sitter to parse source code and Elasticsearch for semantic search.

## Features

-   **Code Parsing**: Uses Tree-sitter to parse TypeScript and JavaScript files.
-   **Chunking**: Extracts meaningful code chunks like functions, classes, and comments.
-   **Vector Embeddings**: Generates placeholder vector embeddings for each chunk.
-   **Elasticsearch Integration**: Stores code chunks and their embeddings in Elasticsearch.

## Project Structure

```
.
├── .env.example
├── .eslintrc.js
├── .gitignore
├── package.json
├── README.md
├── src
│   ├── config.ts
│   ├── elasticsearch.ts
│   ├── embedding.ts
│   ├── index.ts
│   └── parser.ts
└── tsconfig.json
```

-   `src/index.ts`: The main script that orchestrates the indexing process.
-   `src/parser.ts`: Handles parsing of source code files using Tree-sitter.
-   `src/embedding.ts`: Responsible for generating vector embeddings (currently a placeholder).
-   `src/elasticsearch.ts`: Manages the connection and data indexing with Elasticsearch.
-   `src/config.ts`: Loads configuration from environment variables.

## Getting Started

### Prerequisites

-   Node.js (v14 or later)
-   npm
-   An Elasticsearch instance

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd code-indexer
    ```

2.  Install the dependencies:
    ```bash
    npm install
    ```

3.  Set up the environment variables:
    -   Copy the `.env.example` file to a new file named `.env`.
    -   Update the `.env` file with your Elasticsearch credentials.

    ```bash
    cp .env.example .env
    ```

    **`.env` file:**
    ```
    # Elasticsearch configuration
    ELASTICSEARCH_ENDPOINT=http://localhost:9200
    ELASTICSEARCH_USER=elastic
    ELASTICSEARCH_PASSWORD=changeme

    # Alternatively, use an API key
    # ELASTICSEARCH_API_KEY=your_api_key
    ```

### Running the Indexer

To index a directory, run the `start` script with the path to the directory as an argument. If no path is provided, it will index the current directory.

```bash
npm start -- <path-to-your-codebase>
```

For example, to index a project in a directory named `my-project`, you would run:

```bash
npm start -- ./my-project
```

### Querying Elasticsearch

Once the data is indexed, you can perform semantic search queries in Elasticsearch. Here is an example of a `knn` search to find code chunks similar to a given query vector.

**Request:**

```json
POST /code-chunks/_search
{
  "knn": {
    "field": "embedding",
    "query_vector": [0.1, 0.5, ...], // Your query vector
    "k": 5,
    "num_candidates": 10
  },
  "_source": ["filePath", "startLine", "endLine", "content"]
}
```

This query will return the top 5 most similar code chunks based on the provided `query_vector`. You would need to generate a vector for your search query using the same embedding model you would use in a production version of this tool.
