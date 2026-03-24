import path from "node:path";
import { defineConfig } from "@rspack/cli";
import { HtmlRspackPlugin, type RspackPluginFunction } from "@rspack/core";
import RefreshPlugin from "@rspack/plugin-react-refresh";

const isDev = process.env.NODE_ENV !== "production";

export default defineConfig({
	experiments: {
		css: true,
	},
	entry: "./src/main.tsx",
	output: {
		path: path.resolve(import.meta.dirname, "dist"),
		publicPath: "/",
		clean: true,
	},
	resolve: {
		extensions: [".ts", ".tsx", ".js", ".json"],
		alias: {
			"@shared": path.resolve(import.meta.dirname, "../../specs/lib"),
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
							parser: { syntax: "typescript", tsx: true },
							transform: {
								react: {
									runtime: "automatic",
									importSource: "@emotion/react",
									development: isDev,
									refresh: isDev,
								},
							},
						},
					},
				},
				type: "javascript/auto",
			},
			{
				test: /\.css$/,
				type: "css/auto",
			},
		],
	},
	plugins: [
		new HtmlRspackPlugin({
			template: "./index.html",
		}) as unknown as RspackPluginFunction,
		...(isDev ? [new RefreshPlugin()] : []),
	],
	devServer: {
		port: 3738,
		hot: true,
		historyApiFallback: true,
		proxy: [
			{
				context: ["/api"],
				target: "http://localhost:3737",
			},
		],
	},
});
