const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")

// Find the project and workspace directories
const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")

const config = getDefaultConfig(projectRoot)

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot]

// Resolve modules from project + workspace root (pnpm hoisted deps)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]

config.resolver.disableHierarchicalLookup = true

module.exports = config
