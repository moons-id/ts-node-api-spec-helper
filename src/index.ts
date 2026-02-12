#!/usr/bin/env node

import { generator } from "./module/generator.js";
import { updater } from "./module/updater.js";


function getArg(key: string, defaultValue = "") {
  const arg = process.argv.find((a) => a.startsWith(`--${key}=`));
  return arg ? arg.split("=")[1] : defaultValue;
}

async function main() {
  const action = getArg("action", "")
  switch (action) {
    case "generate":
      await generator();
      break;
    case "update":
      await updater();
      break;
    default:
      console.log("Invalid action");
      break;
  }
}

await main()