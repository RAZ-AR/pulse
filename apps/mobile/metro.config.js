const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")
const fs = require("fs")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")
const workspaceModules = path.resolve(workspaceRoot, "node_modules")

// Packages that use "exports" field only (no "main") — map them to their dist entry
const ESM_ONLY_PACKAGES = {
  "copy-anything": "copy-anything/dist/index.js",
  "is-what": "is-what/dist/index.js",
}

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  workspaceModules,
]

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Map ESM-only packages to their concrete dist files
  if (ESM_ONLY_PACKAGES[moduleName]) {
    const resolved = path.resolve(workspaceModules, ESM_ONLY_PACKAGES[moduleName])
    if (fs.existsSync(resolved)) {
      return { type: "sourceFile", filePath: resolved }
    }
  }
  return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
