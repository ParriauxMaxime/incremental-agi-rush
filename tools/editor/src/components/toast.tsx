import { css } from "@emotion/react";
import { useUiStore } from "../store/ui-store";

const containerStyle = css`
	position: fixed;
	bottom: 16px;
	right: 16px;
	display: flex;
	flex-direction: column;
	gap: 8px;
	z-index: 1000;
	pointer-events: none;
`;

const baseToastStyle = css`
	padding: 10px 16px;
	border-radius: 6px;
	font-size: 13px;
	pointer-events: auto;
	cursor: pointer;
	min-width: 200px;
	max-width: 400px;
	animation: slideIn 0.2s ease-out;

	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}
`;

const successStyle = css`
	${baseToastStyle};
	background: #1a4731;
	color: #3fb950;
	border: 1px solid #3fb950;
`;

const errorStyle = css`
	${baseToastStyle};
	background: #4a1a1a;
	color: #e94560;
	border: 1px solid #e94560;
`;

export function ToastContainer() {
	const toasts = useUiStore((s) => s.toasts);
	const removeToast = useUiStore((s) => s.removeToast);

	if (toasts.length === 0) return null;

	return (
		<div css={containerStyle}>
			{toasts.map((toast) => (
				<div
					key={toast.id}
					css={toast.type === "success" ? successStyle : errorStyle}
					onClick={() => removeToast(toast.id)}
				>
					{toast.message}
				</div>
			))}
		</div>
	);
}
