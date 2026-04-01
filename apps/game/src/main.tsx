import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import { App } from "./app";

declare const __BUILD_HASH__: string | undefined;

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

if ("serviceWorker" in navigator && location.hostname !== "localhost") {
	const v = typeof __BUILD_HASH__ !== "undefined" ? __BUILD_HASH__ : "0";
	navigator.serviceWorker.register(`/sw.js?v=${v}`);
}
