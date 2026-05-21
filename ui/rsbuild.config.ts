import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { TanStackRouterRspack } from "@tanstack/router-plugin/rspack";
import { FixMfDataUriPlugin } from "every-plugin/build/rspack";
import { computeSriHashForUrl } from "everything-dev/integrity";
import { withZephyr } from "zephyr-rsbuild-plugin";
import pkg from "./package.json";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const normalizedName = pkg.name;
const shouldDeploy = process.env.DEPLOY === "true";

const resolvedConfigPath = path.resolve(__dirname, "../.bos/bos.resolved-config.json");
const bosConfigPath = path.resolve(__dirname, "../bos.config.json");
const bosConfig = fs.existsSync(resolvedConfigPath)
  ? (() => {
      const raw = JSON.parse(fs.readFileSync(resolvedConfigPath, "utf8"));
      const { _resolved, ...data } = raw;
      return data;
    })()
  : JSON.parse(fs.readFileSync(bosConfigPath, "utf8"));
const uiSharedDeps = bosConfig.shared?.ui ?? {};

function updateBosConfig(url: string, integrity?: string) {
  try {
    const configPath = path.resolve(__dirname, "../bos.config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    if (!config.app.ui) {
      console.error("   ❌ app.ui not found in bos.config.json");
      return;
    }

    config.app.ui.production = url;
    if (integrity) {
      config.app.ui.integrity = integrity;
    } else {
      delete config.app.ui.integrity;
    }
    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
    console.log("   ✅ Updated bos.config.json: app.ui.production");
    if (integrity) {
      console.log("   ✅ Updated bos.config.json: app.ui.integrity");
    }
  } catch (err) {
    console.error("   ❌ Failed to update bos.config.json:", (err as Error).message);
  }
}

const plugins = [
  pluginReact(),
  pluginModuleFederation({
    name: normalizedName,
    filename: "remoteEntry.js",
    dts: false,
    exposes: {
      "./Router": "./src/router.tsx",
      "./Hydrate": "./src/hydrate.tsx",
      "./components": "./src/components/index.ts",
      "./providers": "./src/providers/index.tsx",
      "./hooks": "./src/hooks/index.ts",
    },
    shared: uiSharedDeps,
  }),
];

if (shouldDeploy) {
  plugins.push(
    withZephyr({
      hooks: {
        onDeployComplete: async (info) => {
          console.log("🚀 UI Client Deployed:", info.url);
          const integrity = await computeSriHashForUrl(info.url);
          updateBosConfig(info.url, integrity ?? undefined);
        },
      },
    }),
  );
}

export default defineConfig({
  plugins,
  source: {
    entry: {
      index: "./src/hydrate.tsx",
    },
    define: {
      "import.meta.env.APP_NAME": JSON.stringify(bosConfig.domain),
      "import.meta.env.APP_ACCOUNT": JSON.stringify(bosConfig.account),
    },
  },
  resolve: {
    alias: {
      "@": "./src",
    },
  },
  dev: {
    lazyCompilation: false,
    progressBar: false,
    client: {
      overlay: false,
    },
  },
  server: {
    port: 3003,
    printUrls: ({ urls }) => urls.filter((url) => url.includes("localhost")),
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  },
  tools: {
    rspack: {
      target: "web",
      output: {
        uniqueName: normalizedName,
      },
      resolve: {
        fallback: { bufferutil: false, "utf-8-validate": false },
      },
      infrastructureLogging: { level: "error" },
      stats: "errors-warnings",
      plugins: [
        TanStackRouterRspack({
          target: "react",
          autoCodeSplitting: true,
        }),
        new FixMfDataUriPlugin(),
      ],
    },
  },
  output: {
    distPath: { root: "dist", css: "static/css", js: "static/js" },
    assetPrefix: "auto",
    filename: { js: "[name].js", css: "style.css" },
    copy: [{ from: path.resolve(__dirname, "public"), to: "./" }],
  },
});
