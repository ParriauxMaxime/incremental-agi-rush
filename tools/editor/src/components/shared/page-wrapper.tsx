import { css } from "@emotion/react";
import { type ReactNode, useCallback, useEffect } from "react";
import { useUiStore } from "../../store/ui-store";

interface PageWrapperProps {
	title: string;
	loading: boolean;
	dirty: boolean;
	error: string | null;
	onLoad: () => void;
	onSave: () => Promise<void>;
	onUndo: () => void;
	children: ReactNode;
}

const wrapperStyle = css`
	display: flex;
	flex-direction: column;
	height: 100%;
	gap: 16px;
`;

const headerStyle = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-shrink: 0;
`;

const titleStyle = css`
	font-size: 20px;
	font-weight: 600;
	color: #ccd6f6;
`;

const saveButtonBase = css`
	padding: 8px 20px;
	border: none;
	border-radius: 6px;
	font-size: 14px;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.15s, opacity 0.15s;
`;

const saveButtonClean = css`
	${saveButtonBase}
	background: #2a2a4a;
	color: #556;
	cursor: default;
	opacity: 0.5;
`;

const saveButtonDirty = css`
	${saveButtonBase}
	background: #2d6a4f;
	color: #d8f3dc;
	&:hover {
		background: #40916c;
	}
`;

const loadingStyle = css`
	color: #8892b0;
	font-size: 14px;
	padding: 40px 0;
`;

const errorStyle = css`
	color: #e74c3c;
	font-size: 14px;
	padding: 12px;
	background: rgba(231, 76, 60, 0.1);
	border-radius: 6px;
`;

const contentStyle = css`
	flex: 1;
	overflow: auto;
	min-height: 0;
`;

export function PageWrapper({
	title,
	loading,
	dirty,
	error,
	onLoad,
	onSave,
	onUndo,
	children,
}: PageWrapperProps) {
	const addToast = useUiStore((s) => s.addToast);

	useEffect(() => {
		onLoad();
	}, [onLoad]);

	const handleSave = useCallback(async () => {
		try {
			await onSave();
			addToast("Saved successfully", "success");
		} catch {
			addToast("Failed to save", "error");
		}
	}, [onSave, addToast]);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.ctrlKey && e.key === "z") {
				e.preventDefault();
				onUndo();
			}
			if (e.ctrlKey && e.key === "s") {
				e.preventDefault();
				handleSave();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [onUndo, handleSave]);

	return (
		<div css={wrapperStyle}>
			<div css={headerStyle}>
				<span css={titleStyle}>{title}</span>
				<button
					type="button"
					css={dirty ? saveButtonDirty : saveButtonClean}
					disabled={!dirty}
					onClick={handleSave}
				>
					Save
				</button>
			</div>
			{error && <div css={errorStyle}>{error}</div>}
			{loading ? (
				<div css={loadingStyle}>Loading...</div>
			) : (
				<div css={contentStyle}>{children}</div>
			)}
		</div>
	);
}
