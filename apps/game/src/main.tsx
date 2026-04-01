import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./i18n";
import { App } from "./app";

declare const __BUILD_HASH__: string;

const root = document.getElementById("root");
if (!root) throw new Error("Root element not found");

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);

if ("serviceWorker" in navigator && location.hostname !== "localhost") {
	navigator.serviceWorker.register(`/sw.js?v=${__BUILD_HASH__}`);
}
