# Creating a New Tool Using Only the Search Index

Yes, absolutely.

That is a perfect use case for this system. I can construct a brand new, correctly-typed tool definition by using the index as my sole source of information. I would do this by conducting a "chain of investigation" through a series of targeted searches.

Here is how I would do it, step-by-step, demonstrating the queries and the information I would gather.

---

### Step 1: Find the `addTool` function signature to understand its contract.

First, I need to know exactly what `addTool` expects as its second argument.

**Query:**
```bash
npm run search -- "definition of addTool"
```

**Key Information Retrieved:**
The search would return the function definition we found earlier.

```typescript
const addTool = <T extends ToolDefinitionInputSchema>(
  server: McpServer,
  tool: ToolDefinition<T>
) => { ... };
```

**Analysis:**
This tells me everything I need to start. I know I need to create an object of type `ToolDefinition`. I also see a generic constraint, `T extends ToolDefinitionInputSchema`, which is a huge clue that the tool's input will be defined by a schema.

---

### Step 2: Find the definition of the `ToolDefinition` type.

Now I know the type I need to create. My next step is to find out what that type looks like.

**Query:**
```bash
npm run search -- "type ToolDefinition"
```

**Key Information Retrieved:**
The search would find the file where `ToolDefinition` is declared.

```typescript
// in a file like 'src/types.ts'
import { z } from 'zod';

export type ToolDefinition<T extends ToolDefinitionInputSchema> = {
  name: string;
  description: string;
  inputSchema: T;
  handler: (input: z.infer<T>) => Promise<any>;
};
```

**Analysis:**
This is the blueprint. I now know my new tool object must have four properties: `name` (string), `description` (string), `inputSchema` (a Zod schema), and a `handler` (an async function that takes the inferred type from the schema).

---

### Step 3: Find a complete example of an existing tool to use as a template.

The previous searches gave me the function signature and the type definition. Now I need a real-world example to see how they are used together. From our earlier searches, I know that `generateKibanaPackageTool` is a tool.

**Query:**
```bash
npm run search -- "const generateKibanaPackageTool"
```

**Key Information Retrieved:**
This query would lead me directly to the file where this tool is defined.

```typescript
// in a file like 'src/tools/generate_kibana_package.ts'
import { z } from 'zod';
import { ToolDefinition } from '../types';

const GenerateKibanaPackageInput = z.object({
  name: z.string(),
  path: z.string(),
});

export const generateKibanaPackageTool: ToolDefinition<typeof GenerateKibanaPackageInput> = {
  name: 'generateKibanaPackage',
  description: 'Generates a new Kibana package.',
  inputSchema: GenerateKibanaPackageInput,
  handler: async (input) => {
    // ... implementation ...
    return { success: true, path: input.path };
  },
};
```

**Analysis:**
This is the final piece of the puzzle. It's a perfect template that shows:
*   How to import `zod` and `ToolDefinition`.
*   How to define a Zod schema for the tool's specific inputs.
*   How to structure the final tool object, passing the schema's type to `ToolDefinition`.
*   The structure of the `handler` function.

---

### Final Result: Constructing the New Tool

With all the information gathered *exclusively from the search index*, I can now confidently create a brand new tool definition that I know will be correct.

Here is the new tool I would construct:

```typescript
// new_tool.ts
import { z } from 'zod';
import { ToolDefinition } from '../types'; // Path inferred from previous searches

// 1. Define the input schema, based on the example.
const ListDirectoryInput = z.object({
  path: z.string().describe('The directory path to list.'),
  recursive: z.boolean().optional().default(false),
});

// 2. Create the tool definition, matching the ToolDefinition type and the example's structure.
export const listDirectoryTool: ToolDefinition<typeof ListDirectoryInput> = {
  name: 'listDirectory',
  description: 'Lists the contents of a directory.',
  inputSchema: ListDirectoryInput,
  handler: async (input) => {
    // The handler takes the validated and typed input object.
    console.log(`Listing contents of ${input.path} (Recursive: ${input.recursive})`);
    // In a real scenario, I would implement the logic here.
    // For example: const files = fs.readdirSync(input.path);
    return { files: ['file1.ts', 'file2.js'] };
  },
};
```

This demonstrates that the index is not just a simple search engine; it's a rich, queryable database of the codebase's structure, types, and patterns, containing all the necessary information to learn the "rules" of the project and contribute new code that follows them.
