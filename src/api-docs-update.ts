#!/usr/bin/env node

import fs from "fs";
import path from "path";
import readline from "readline";
import yaml from "js-yaml";

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * Get all files recursively from a directory
 */
function walkDir(dirPath: string, fileList: string[] = []) {
  try {
    const files = fs.readdirSync(dirPath);

    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        walkDir(filePath, fileList);
      } else if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        fileList.push(filePath);
      }
    });
  } catch (error) {
    if ((error as any).code !== 'ENOENT') {
      console.error(`Error reading directory: ${(error as Error).message}`);
    }
  }

  return fileList;
}

/**
 * Encode JSON Pointer reference (escape / with ~1)
 */
function encodeJsonPointer(str: string) {
  return str.replace(/\//g, '~1');
}

/**
 * Get relative path from base directory
 */
function getRelativePath(filePath: string, baseDir: string) {
  const realFilePath = path.resolve(filePath);
  const realBaseDir = path.resolve(baseDir);

  if (!realFilePath.startsWith(realBaseDir)) {
    return filePath;
  }

  return './' + path.relative(realBaseDir, realFilePath);
}

/**
 * Load YAML file
 */
function loadYaml(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.load(content) || {};
  } catch (error) {
    console.error(`Error reading YAML file ${filePath}: ${(error as Error).message}`);
    return {};
  }
}

/**
 * Save YAML file
 */
function saveYaml(filePath: string, data: any) {
  try {
    const content = yaml.dump(data, {
      lineWidth: -1,
      forceQuotes: false,
      sortKeys: false
    });
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch (error) {
    console.error(`Error writing YAML file ${filePath}: ${(error as Error).message}`);
    return false;
  }
}

/**
 * Main program
 */
async function main() {
  try {
    let apiDocsPath = 'resource/api-docs/v1/api-docs.yaml';

    // Check if API docs file exists (with retry)
    while (!fs.existsSync(apiDocsPath)) {
      console.error(`❌ API spec not found at ${apiDocsPath}`);
      apiDocsPath = await question('Enter path to the api-docs.yaml (or other OAS main file): ');
      apiDocsPath = apiDocsPath.trim();
    }

    const pathsDir = path.join(path.dirname(apiDocsPath), 'paths');

    console.log(`\n📂 API Docs: ${apiDocsPath}`);
    console.log(`📂 Paths Dir: ${pathsDir}\n`);

    // Step 1: Clear existing paths from main API docs
    console.log('1️⃣ Clearing existing paths...');
    let apiDocs: any = loadYaml(apiDocsPath);

    // Delete existing paths
    if (apiDocs.paths) {
      delete apiDocs.paths;
    }

    // Re-add empty paths object
    apiDocs.paths = {};

    if (!saveYaml(apiDocsPath, apiDocs)) {
      process.exit(1);
    }
    console.log('✔ Paths cleared\n');

    // Step 2: Walk all path files
    console.log('2️⃣ Collecting path files...');

    if (!fs.existsSync(pathsDir)) {
      console.error(`❌ Paths directory not found: ${pathsDir}`);
      process.exit(1);
    }

    const pathFiles = walkDir(pathsDir);

    if (pathFiles.length === 0) {
      console.warn('⚠️  No path files found');
      console.log('✔ Done (no paths to rebuild)');
      rl.close();
      return;
    }

    console.log(`✔ Found ${pathFiles.length} path file(s)\n`);
    console.log('3️⃣ Building references...\n');

    // Reload the main API docs file
    apiDocs = loadYaml(apiDocsPath);

    // Process each path file
    let totalRefs = 0;
    const baseDir = path.dirname(apiDocsPath);

    for (const filePath of pathFiles) {
      const pathFile: any = loadYaml(filePath);

      // Extract paths from this file
      if (!pathFile.paths || typeof pathFile.paths !== 'object') {
        continue;
      }

      // For each API path in the file
      for (const apiPath in pathFile.paths) {
        const pathObj = pathFile.paths[apiPath];

        if (!pathObj || typeof pathObj !== 'object') {
          continue;
        }

        // For each HTTP method under that path
        for (const method in pathObj) {
          // Skip non-method properties like x-*
          if (method.startsWith('x-') || method.startsWith('$')) {
            continue;
          }

          const validMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace', 'connect'];
          if (!validMethods.includes(method.toLowerCase())) {
            continue;
          }

          // Encode the JSON Pointer
          const encodedPath = encodeJsonPointer(apiPath);

          // Get relative path from base directory
          const relPath = getRelativePath(filePath, baseDir);

          // Build the reference
          const ref = `${relPath}#/paths/${encodedPath}/${method}`;

          console.log(`  📍 ${method.toUpperCase()} ${apiPath} -> ${ref}`);

          // Initialize paths object if needed
          if (!apiDocs.paths[apiPath]) {
            apiDocs.paths[apiPath] = {};
          }

          // Add the $ref
          apiDocs.paths[apiPath][method] = {
            $ref: ref
          };

          totalRefs++;
        }
      }
    }

    console.log();

    // Save the updated main API docs
    if (!saveYaml(apiDocsPath, apiDocs)) {
      process.exit(1);
    }

    console.log(`✔ Rebuilt ${totalRefs} reference(s) successfully`);
    console.log('✔ All done! 👍');

  } catch (error) {
    console.error(`Fatal error: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run main program
main().catch((error) => {
  console.error(`Error: ${(error as Error).message}`);
  process.exit(1);
});