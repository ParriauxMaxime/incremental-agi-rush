import { defineConfig } from "@rspack/cli";
import { HtmlRspackPlugin, type RspackPluginFunction } from "@rspack/core";

export default defineConfig({
	entry: "./src/main.tsx",
	resolve: {
		extensions: [".ts", ".tsx", ".js", ".jsx"],
		alias: {
			"@": "./src",
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
