import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "@rspack/cli";
import {
	type Compiler,
	CopyRspackPlugin,
	DefinePlugin,
	HtmlRspackPlugin,
	type RspackPluginFunction,
} from "@rspack/core";

const BUILD_HASH = Date.now().toString(36);

/** Stamps __BUILD_HASH__ in sw.js at emit time */
class StampSwPlugin {
	apply(compiler: Compiler) {
		compiler.hooks.thisCompilation.tap("StampSwPlugin", (compilation) => {
			compilation.hooks.processAssets.tap("StampSwPlugin", () => {
				const swPath = path.resolve(__dirname, "public/sw.js");
				const src = fs.readFileSync(swPath, "utf8");
				const stamped = src.replace("__BUILD_HASH__", BUILD_HASH);
				compilation.emitAsset(
					"sw.js",
					new compiler.webpack.sources.RawSource(stamped),
				);
			});
		});
	}
}

export default defineConfig({
	experiments: {
		css: true,
	},
	entry: "./src/main.tsx",
	output: {
		publicPath: "/",
	},
	resolve: {
		extensions: [".ts", ".tsx", ".js", ".jsx"],
		alias: {
			"@modules": path.resolve(__dirname, "src/modules"),
			"@components": path.resolve(__dirname, "src/components"),
			"@utils": path.resolve(__dirname, "src/utils"),
		},
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: {
					loader: "builtin:swc-loader",
					options: {
						jsc: {
							parser: {
								syntax: "typescript",
								tsx: true,
							},
							transform: {
								react: {
									runtime: "automatic",
									importSource: "@emotion/react",
								},
							},
						},
					},
				},
				type: "javascript/auto",
			},
			{
				test: /\.css$/,
				type: "css",
			},
		],
	},
	plugins: [
		new DefinePlugin({
			__BUILD_HASH__: JSON.stringify(BUILD_HASH),
		}) as unknown as RspackPluginFunction,
		new HtmlRspackPlugin({
			template: "./src/index.html",
		}) as unknown as RspackPluginFunction,
		new CopyRspackPlugin({
			patterns: [
				{ from: "public", to: ".", globOptions: { ignore: ["**/sw.js"] } },
			],
		}) as unknown as RspackPluginFunction,
		new StampSwPlugin() as unknown as RspackPluginFunction,
	],
	devServer: {
		port: 3000,
		hot: true,
	},
});
