import protocols from "../protocols/data";
import treasuries from "../protocols/treasury";
import { writeFileSync, readdirSync } from "fs"
import { execSync } from "child_process"
import { Adapter } from "@defillama/dimension-adapters/adapters/types";
import entities from "../protocols/entities";
import { setModuleDefaults } from "@defillama/dimension-adapters/adapters/utils/runAdapter";

function getUnique(arry: string[]) {
  return [...new Set(arry)]
}

// Add error handling for writing adapter imports
try {
  writeFileSync("./src/utils/imports/adapters.ts",
    `export default {
    ${getUnique(protocols.concat(treasuries).concat(entities).map(p => `"${p.module}": require("@defillama/adapters/projects/${p.module}"),`)).join('\n')}
}`)
} catch (error) {
  console.log('Error writing adapters.ts:', error)
}

createImportAdaptersJSON()

// Add error handling for writing liquidation adapters
try {
  const excludeLiquidation = ["test.ts", "utils", "README.md"]
  writeFileSync("./src/utils/imports/adapters_liquidations.ts",
    `export default {
    ${readdirSync("./DefiLlama-Adapters/liquidations").filter(f => !excludeLiquidation.includes(f))
      .map(f => `"${f}": require("@defillama/adapters/liquidations/${f}"),`).join('\n')}
}`)
} catch (error) {
  console.log('Error writing adapters_liquidations.ts:', error)
}

// For adapters type adaptor
function getDirectories(source: string) {
  return readdirSync(source, { withFileTypes: true })
    .map(dirent => dirent.name)
}

const extensions = ['ts', 'md', 'js']
function removeDotTs(s: string) {
  const splitted = s.split('.')
  if (splitted.length > 1 && extensions.includes(splitted[splitted.length - 1]))
    splitted.pop()
  return splitted.join('.')
}

// dimension-adapters

const excludeKeys = ["index", "README", '.gitkeep']
const baseFolderPath = "./dimension-adapters" // path relative to current working directory -> `cd /defi`
const basePackagePath = "@defillama/dimension-adapters" // how is defined in package.json
const baseGithubURL = "https://github.com/DefiLlama/dimension-adapters/blob/master"
const importPaths = [
  "dexs",
  "fees",
  "aggregators",
  "options",
  "incentives",
  "aggregator-derivatives",
  "bridge-aggregators"
]

// Add error handling for dimension adapters
for (const folderPath of importPaths) {
  try {
    const paths_keys = getDirectories(`${baseFolderPath}/${folderPath}`).filter(key => !excludeKeys.includes(key))
    writeFileSync(`./src/utils/imports/${folderPath.replace("/", "_")}_adapters.ts`,
      `
import { Adapter } from "@defillama/dimension-adapters/adapters/types";
export default {
${paths_keys.map(path => {
        try {
          const response = createDimensionAdaptersModule(path, folderPath)
          return response
        } catch (error) {
          console.log(`Error creating module for ${path} in ${folderPath}:`, error)
          return ''
        }
      }).join('\n')}
} as any as {[key:string]: {
    moduleFilePath: string,
    module: { default: Adapter },
    codePath: string
} }

        `)
  } catch (error) {
    console.log(`Error writing ${folderPath} adapters:`, error)
  }
}

function createDimensionAdaptersModule(path: string, folderPath: string) {
  const moduleFilePath = `${basePackagePath}/${folderPath}/${removeDotTs(path)}`

  let module = require(moduleFilePath)
  if (!module.default) {
    throw new Error(`Module ${moduleFilePath} does not have a default export`)
  }
  setModuleDefaults(module.default)
  module = mockFunctions(module)

  return `"${removeDotTs(path)}": {
        moduleFilePath: "${moduleFilePath}",
        module: ${JSON.stringify(module)},
        codePath: "${baseGithubURL}/${folderPath}/${path}"
    },`
}

// Above type should match
export interface IImportObj {
  module: { default: Adapter },
  codePath: string
  moduleFilePath: string
}

// emissions-adapters
// Add error handling for emissions adapters
try {
  const emission_keys = getDirectories(`./emissions-adapters/protocols`)
  writeFileSync(`./src/utils/imports/emissions_adapters.ts`,
    `export default {
    ${emission_keys.map(k => `"${removeDotTs(k)}":require("@defillama/emissions-adapters/protocols/${k}"),`).join('\n')}
}`)
} catch (error) {
  console.log('Error writing emissions_adapters.ts:', error)
}

function createImportAdaptersJSON() {
  try {
    const adaptersFile = __dirname + "/../utils/imports/tvlAdapterData.json"
    let data: any = {}
    protocols.concat(treasuries).concat(entities).map(p => data[p.module] = `@defillama/adapters/projects/${p.module}`)
    writeFileSync(adaptersFile, JSON.stringify(data, null, 2))
    // we are running this as JS file because it is faster than compiling as ts
    execSync(['node', __dirname + "/buildTvlModuleData.js", adaptersFile].join(' '), { stdio: 'inherit' })
  } catch (error) {
    console.log('Error creating import adapters JSON:', error)
  }
}

//Replace all fuctions with mock functions in an object all the way down
function mockFunctions(obj: any) {
  if (typeof obj === "function") {
    return '_lmtf'  // llamaMockedTVLFunction
  } else if (typeof obj === "object") {
    Object.keys(obj).forEach((key) => obj[key] = mockFunctions(obj[key]))
  }
  return obj
}
