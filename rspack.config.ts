import path from "node:path";
import { defineConfig } from "@rspack/cli";
import { HtmlRspackPlugin, type RspackPluginFunction } from "@rspack/core";

const isProd = process.env.NODE_ENV === "production";

export default defineConfig({
	entry: "./src/main.tsx",
	output: {
		publicPath: isProd ? "/incremental-agi-rush/" : "/",
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
		new HtmlRspackPlugin({
			template: "./src/index.html",
		}) as unknown as RspackPluginFunction,
	],
	devServer: {
		port: 3000,
		hot: true,
	},
});
