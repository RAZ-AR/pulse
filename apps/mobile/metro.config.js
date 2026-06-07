const { getDefaultConfig } = require("expo/metro-config")
const path = require("path")
const fs = require("fs")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")
const workspaceModules = path.resolve(workspaceRoot, "node_modules")
const workspacePackages = path.resolve(workspaceRoot, "packages")

// Packages that use "exports" field only (no "main") — map them to their dist entry
const ESM_ONLY_PACKAGES = {
  "copy-anything": "copy-anything/dist/index.js",
  "is-what": "is-what/dist/index.js",
}

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspacePackages]

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  workspaceModules,
]

config.resolver.disableHierarchicalLookup = true
config.resolver.extraNodeModules = {
  react: path.resolve(workspaceModules, "react"),
  "react-dom": path.resolve(workspaceModules, "react-dom"),
  "react/jsx-runtime": path.resolve(workspaceModules, "react/jsx-runtime"),
}

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

// Use default (Babel) transform for web — Hermes transform hangs in this monorepo setup
config.transformer = {
  ...config.transformer,
  unstable_transformProfile: "default",
}

module.exports = config
