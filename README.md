# API Docs Generator - Node.js Version

A Node.js conversion of the original Bash script for generating OpenAPI/Swagger documentation paths from templates.

## Prerequisites

- Node.js 20.0.0 or higher
- npm or yarn

## Installation

```bash
npm install
```

This installs the `js-yaml` dependency needed to parse YAML files.

## Usage

```bash
node api-docs-generator.js
```

Or if you installed it globally:

```bash
npm install -g .
api-docs-generator
```

## Features

- **Interactive CLI** - Prompts user for API details (method, path, title, domain, author)
- **Validation** - Validates HTTP methods, paths, and author codes
- **YAML Parsing** - Reads API version from OpenAPI spec files
- **Parameter Extraction** - Automatically extracts path and query parameters from URLs
- **Template Generation** - Generates API documentation files from templates with variable substitution
- **Author Tracking** - Maps author codes (daf, kam, muf, nov, sal) to full names

## Configuration Files

The script expects these paths to exist:

- **API Spec**: default to `resource/api-docs/v1/api-docs.yaml` (or user-provided path)

Output files are generated in: `{API_SPEC_DIR}/paths/{domain}/{method}-{operation}.yaml`

## Prompts

When run, the script will ask for:

1. **HTTP Method** - GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, TRACE, CONNECT
2. **Path** - API path with optional path parameters in `{param}` format
3. **Title** - Human-readable title for the endpoint
4. **Domain** - Category/tag for the endpoint (e.g., "users", "products")
5. **Author** - Code for who created this using GitHub username

## Path Examples

Valid paths:
```
/users
/users/{userId}
/users/{userId}/posts?filter=active&sort=date
/products/{id}/reviews
```

Invalid paths:
```
users                    # Must start with /
/users/:id               # Use {id} instead of :id
/users?query=value       # Query string should be after path validation
```

## Path Parameter Handling

**Path Parameters** (in `{curly braces}`):
- Automatically extracted from path
- Marked as `required: true` in generated YAML
- Type set to `string`

**Query Parameters** (after `?`):
- Extracted from URL query string
- Marked as `in: query` in generated YAML
- Schema stub generated for manual completion

## Output

The script generates a YAML file with:

```yaml
/{path}:
  {method}:
    operationId: {operation_id}
    summary: {title}
    tags:
      - {domain}
    parameters: [...]
    responses:
      '200':
        description: Success
        content:
          application/json:
            schema:
              type: object
    x-author: {author}
    x-api-version: {version}
```

## Troubleshooting
**"API spec not found"**
- Provide the correct path to your OpenAPI specification file, relative to your caller location when prompted

**"Could not read info.version"**
- Ensure the API spec has a valid `info.version` field in YAML format

[Novando](https://localhost.com)