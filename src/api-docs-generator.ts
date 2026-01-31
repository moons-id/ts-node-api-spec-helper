#!/usr/bin/env node

import fs from "fs";
import path from "path";
import readline, {type Interface} from "readline";
import yaml from "js-yaml";

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const validMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace', 'connect'];

// Promisify readline question
function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * Generate parameters YAML from path and query params
 */
function generateParametersYaml(pathParams: string[], queryParams: string[]) {
  let yaml = '';

  // Path parameters
  for (const param of pathParams) {
    if (param.trim()) {
      yaml += `        - in: path
          name: ${param}
          required: true
          type: string
`;
    }
  }

  // Query parameters
  for (const param of queryParams) {
    if (param.trim()) {
      yaml += `        - in: query
          name: ${param}
          type: string
`;
    }
  }

  return yaml;
}

/**
 * Validate HTTP method
 */
async function validateMethod(method: string) {
  let methodLower = method.toLowerCase();

  while (!validMethods.includes(methodLower)) {
    console.error(`❌ Invalid HTTP method: ${method}`);
    methodLower = await question('Reinsert: ');
    methodLower = methodLower.toLowerCase();
  }

  return methodLower;
}

/**
 * Validate API path
 */
async function validatePath(rawPath: string) {
  let path = rawPath;

  while (true) {
    // Empty input
    if (!path.trim()) {
      console.error('❌ Invalid path: path cannot be empty.');
      path = await question('Reinsert: ');
      continue;
    }

    // Must start with /
    if (!path.startsWith('/')) {
      console.error('❌ Invalid path: path must start with \'/\'.');
      path = await question('Reinsert: ');
      continue;
    }

    // Disallow colon-style params
    if (path.includes(':')) {
      console.error('❌ Invalid path: \':\' is not allowed. Use {param} instead.');
      path = await question('Reinsert: ');
      continue;
    }

    if (path.split('?').length > 2) {
      console.error('❌ Invalid path: multiple ? is not allowed.');
      path = await question('Reinsert: ');
      continue;
    }

    break;
  }

  return path;
}

/**
 * Extract path parameters from path string
 */
function extractPathParams(pathStr: string): string[] {
  const matches = pathStr.match(/{[^}]*}/g) || [];
  return matches.map(m => m.replace(/[{}]/g, ''));
}

/**
 * Extract query parameters from path string
 */
function extractQueryParams(pathStr: string) {
  if (!pathStr.includes('?')) {
    return [];
  }
  const queryStr = pathStr.split('?')[1];
  return queryStr.split('&').map(q => q.split('=')[0]);
}

/**
 * Extract API version from YAML file
 */
function extractApiVersion(apiSpecPath: string) {
  try {
    const content = fs.readFileSync(apiSpecPath, 'utf8');
    const doc: any = yaml.load(content);
    return doc?.info?.version || null;
  } catch (error) {
    console.error(`Error reading API spec: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Generate operation path slug
 */
function generateOpPath(pathStr: string) {
  return pathStr
    .split('?')[0]
    .split('/') // Split by /
    .filter(p => p) // Remove empty parts
    .join('-') // Join with -
    .replace(/[{}]/g, ''); // Remove braces
}

/**
 * Generate output file path
 */
function generateOutputPath(apiSpecPath: string, domain: string, method: string, opPath: string) {
  const baseDir = path.dirname(apiSpecPath);
  const filename = `${method}-${opPath}.yaml`;
  const filePath = path.join(baseDir, 'paths', domain, filename);

  const relativePath = filePath.split(process.cwd())[1].toLowerCase().replace(/ /g, '-');
  return `${process.cwd()}/${relativePath}`;
}

/**
 * Load template file
 */
function loadTemplate(templatePath: string) {
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch (error) {
    console.error(`❌ Template not found at ${templatePath}`);
    process.exit(1);
  }
}

/**
 * Replace template variables
 */
function replaceTemplateVars(template: string, variables: Record<string, string>) {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    result = result.split(placeholder).join(value);
  }

  return result;
}

/**
 * Main program
 */
async function main() {
  try {
    let apiSpecPath = `${process.cwd()}/resource/api-docs/v1/api-docs.yaml`;
    const templatePath = 'resource/apispec-template.yaml';

    // Check template exists
    if (!fs.existsSync(templatePath)) {
      console.error(`❌ Template not found at ${templatePath}`);
      process.exit(1);
    }

    // Check API spec exists (with retry)
    while (!fs.existsSync(apiSpecPath)) {
      console.error(`❌ API spec not found at ${apiSpecPath}`);
      const newPath = await question('Enter path to the api-docs.yaml (or other OAS main file): ');
      apiSpecPath = `${process.cwd()}/${newPath}`;
    }

    // Extract API version
    const apiVersion = extractApiVersion(apiSpecPath);
    if (!apiVersion) {
      console.error('❌ Could not read info.version from api-docs.yaml');
      process.exit(1);
    }
    console.log(`✔ API version detected: ${apiVersion}\n`);

    // Get HTTP method
    console.log('---- New API Path ----');
    let method = await question('HTTP method (e.g. get, post): ');
    const methodLower = await validateMethod(method);
    const methodUpper = methodLower.toUpperCase();
    console.log();

    // Get path
    console.log('Path without base, query is acceptable');
    const rawPath = await question('e.g. /sample/paths/with/{pathParam}): ');
    const pathOnly = await validatePath(rawPath);
    console.log();

    // Extract parameters
    const pathParams = extractPathParams(pathOnly);
    const queryParams = extractQueryParams(rawPath);

    // Get title
    const title = await question('Title: ');
    console.log();

    // Get domain
    const domain = await question('Domain: ');
    console.log();

    // Get author
    const author = await question('Your Github username? ');

    // Generate paths
    const opPath = generateOpPath(pathOnly);
    const outputFile = generateOutputPath(apiSpecPath, domain, methodLower, opPath);

    // Generate parameters YAML
    const paramsYaml = generateParametersYaml(pathParams, queryParams);
    const finalParamsYaml = paramsYaml.trim() ? paramsYaml : '        []\n';

    // Load template
    const template = loadTemplate(templatePath);

    // Prepare template variables
    const variables = {
      PATH: pathOnly.split('?')[0],
      METHOD_LOWER: methodLower,
      METHOD_UPPER: methodUpper,
      OP_PATH: opPath,
      TITLE: title,
      TAG: domain,
      API_VERSION: apiVersion,
      AUTHOR: `[${author}](https://github.com/${author})`,
      PARAMETERS: finalParamsYaml.trimEnd()
    };

    // Replace template variables
    let output = replaceTemplateVars(template, variables);

    // Add trailing newline
    if (!output.endsWith('\n')) {
      output += '\n';
    }

    // Create output directory
    const outputDir = path.dirname(outputFile);
    fs.mkdirSync(outputDir, { recursive: true });

    // Write output file
    fs.writeFileSync(outputFile, output, 'utf8');

    console.log(`\n✔ Created ${methodUpper} ${pathOnly}`);
    console.log('Done 👍');

  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run main program
main().catch((error) => {
  console.error(`Fatal error: ${error.message}`);
  process.exit(1);
});