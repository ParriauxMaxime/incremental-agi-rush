import type { RefObject } from "react";
import { useEffect } from "react";

export function useEditorFocus(ref: RefObject<HTMLElement | null>) {
	useEffect(() => {
		ref.current?.focus();

		function handleClick(e: MouseEvent) {
			const target = e.target as HTMLElement;
			// Don't steal focus from interactive areas
			if (
				target.closest("[data-sidebar]") ||
				target.closest("[data-terminal]") ||
				target.closest("input") ||
				target.closest("button")
			) {
				return;
			}
			ref.current?.focus();
		}

		document.addEventListener("click", handleClick);
		return () => document.removeEventListener("click", handleClick);
	}, [ref]);
}
