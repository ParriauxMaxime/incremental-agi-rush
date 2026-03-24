import { css } from "@emotion/react";
import { useCallback, useMemo, useState } from "react";
import { PageWrapper } from "../../components/shared/page-wrapper";
import { useBalanceStore } from "../../store/data-store";

const sectionStyle = css`
	margin-bottom: 16px;
	border: 1px solid #2a2a4a;
	border-radius: 8px;
	overflow: hidden;
`;

const sectionHeaderStyle = css`
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 16px;
	background: #16213e;
	cursor: pointer;
	user-select: none;
	&:hover {
		background: #1a2744;
	}
`;

const sectionTitleStyle = css`
	font-size: 14px;
	font-weight: 600;
	color: #64ffda;
	text-transform: uppercase;
	letter-spacing: 0.5px;
`;

const chevronStyle = css`
	color: #8892b0;
	font-size: 12px;
`;

const sectionBodyStyle = css`
	padding: 16px;
	display: flex;
	flex-direction: column;
	gap: 12px;
`;

const fieldRowStyle = css`
	display: flex;
	align-items: center;
	gap: 12px;
`;

const fieldLabelStyle = css`
	font-size: 13px;
	color: #8892b0;
	min-width: 200px;
	flex-shrink: 0;
`;

const fieldInputStyle = css`
	background: #0a0f1e;
	border: 1px solid #2a2a4a;
	border-radius: 4px;
	color: #ccd6f6;
	padding: 6px 10px;
	font-size: 13px;
	width: 200px;
	&:focus {
		outline: none;
		border-color: #64ffda;
	}
`;

const noteStyle = css`
	font-size: 11px;
	color: #556;
	font-style: italic;
	margin-left: 8px;
`;

const miniTableStyle = css`
	width: 100%;
	border-collapse: collapse;
	font-size: 13px;
	margin-top: 4px;
`;

const miniThStyle = css`
	text-align: left;
	padding: 6px 8px;
	color: #8892b0;
	font-weight: 500;
	border-bottom: 1px solid #2a2a4a;
	font-size: 12px;
`;

const miniTdStyle = css`
	padding: 4px 8px;
	border-bottom: 1px solid #1a1a3a;
`;

const miniInputStyle = css`
	background: transparent;
	border: 1px solid transparent;
	border-radius: 3px;
	color: #ccd6f6;
	padding: 4px 6px;
	font-size: 13px;
	width: 100%;
	box-sizing: border-box;
	&:focus {
		outline: none;
		border-color: #64ffda;
		background: #16213e;
	}
`;

const subSectionStyle = css`
	margin-left: 16px;
	padding-left: 12px;
	border-left: 2px solid #2a2a4a;
`;

const subSectionTitleStyle = css`
	font-size: 13px;
	font-weight: 600;
	color: #ccd6f6;
	margin-bottom: 8px;
	margin-top: 8px;
`;

type BalanceData = Record<string, unknown>;

function isNote(key: string): boolean {
	return key.startsWith("_");
}

function isPrimitive(
	value: unknown,
): value is string | number | boolean | null {
	return (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	);
}

function isArrayOfObjects(value: unknown): value is Record<string, unknown>[] {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		typeof value[0] === "object" &&
		value[0] !== null
	);
}

function isPlainObject(
	value: unknown,
): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface CollapsibleSectionProps {
	title: string;
	children: React.ReactNode;
	defaultOpen?: boolean;
}

function CollapsibleSection({
	title,
	children,
	defaultOpen = false,
}: CollapsibleSectionProps) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div css={sectionStyle}>
			<div
				css={sectionHeaderStyle}
				onClick={() => setOpen((o) => !o)}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") setOpen((o) => !o);
				}}
				role="button"
				tabIndex={0}
			>
				<span css={sectionTitleStyle}>{title}</span>
				<span css={chevronStyle}>{open ? "\u25BC" : "\u25B6"}</span>
			</div>
			{open && <div css={sectionBodyStyle}>{children}</div>}
		</div>
	);
}

interface MiniTableProps {
	data: Record<string, unknown>[];
	onChange: (newData: Record<string, unknown>[]) => void;
}

function MiniTable({ data, onChange }: MiniTableProps) {
	if (data.length === 0) return null;
	const keys = Object.keys(data[0]).filter((k) => !isNote(k));

	return (
		<table css={miniTableStyle}>
			<thead>
				<tr>
					{keys.map((k) => (
						<th key={k} css={miniThStyle}>
							{k}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{data.map((row, rowIdx) => (
					<tr key={rowIdx}>
						{keys.map((k) => (
							<td key={k} css={miniTdStyle}>
								<input
									css={miniInputStyle}
									value={
										row[k] === null || row[k] === undefined
											? ""
											: String(row[k])
									}
									onChange={(e) => {
										const next = [...data];
										const val = e.target.value;
										const numVal = Number(val);
										next[rowIdx] = {
											...row,
											[k]:
												val === ""
													? ""
													: Number.isNaN(numVal)
														? val
														: numVal,
										};
										onChange(next);
									}}
								/>
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}

interface FieldEditorProps {
	path: string[];
	obj: Record<string, unknown>;
	onChange: (path: string[], value: unknown) => void;
}

function FieldEditor({ path, obj, onChange }: FieldEditorProps) {
	const entries = Object.entries(obj).filter(([k]) => !isNote(k));

	return (
		<>
			{entries.map(([key, value]) => {
				const currentPath = [...path, key];
				const noteKey = `_${key}Note`;
				const altNoteKey = `_${key}`;
				const note =
					(obj[noteKey] as string | undefined) ??
					(obj[altNoteKey] as string | undefined);

				if (isArrayOfObjects(value)) {
					return (
						<div key={key}>
							<div css={subSectionTitleStyle}>{key}</div>
							<MiniTable
								data={value}
								onChange={(newData) =>
									onChange(currentPath, newData)
								}
							/>
						</div>
					);
				}

				if (isPlainObject(value)) {
					return (
						<div key={key} css={subSectionStyle}>
							<div css={subSectionTitleStyle}>{key}</div>
							<FieldEditor
								path={currentPath}
								obj={value}
								onChange={onChange}
							/>
						</div>
					);
				}

				if (isPrimitive(value)) {
					return (
						<div key={key} css={fieldRowStyle}>
							<label css={fieldLabelStyle}>{key}</label>
							<input
								css={fieldInputStyle}
								type={
									typeof value === "number"
										? "number"
										: "text"
								}
								step={
									typeof value === "number" ? "any" : undefined
								}
								value={
									value === null || value === undefined
										? ""
										: String(value)
								}
								onChange={(e) => {
									const val = e.target.value;
									const numVal = Number(val);
									const newValue =
										typeof value === "number"
											? val === ""
												? 0
												: numVal
											: val;
									onChange(currentPath, newValue);
								}}
							/>
							{note && typeof note === "string" && (
								<span css={noteStyle}>{note}</span>
							)}
						</div>
					);
				}

				return null;
			})}
		</>
	);
}

export function BalancePage() {
	const store = useBalanceStore();
	const data = useMemo(
		() => (store.data ?? {}) as BalanceData,
		[store.data],
	);

	const handleLoad = useCallback(() => {
		store.load();
	}, [store.load]);

	const handleSave = useCallback(async () => {
		await store.save();
	}, [store.save]);

	const handleFieldChange = useCallback(
		(path: string[], value: unknown) => {
			const next = structuredClone(data);
			let current: Record<string, unknown> = next;
			for (let i = 0; i < path.length - 1; i++) {
				current = current[path[i]] as Record<string, unknown>;
			}
			current[path[path.length - 1]] = value;
			store.update(next);
		},
		[data, store.update],
	);

	const topLevelKeys = Object.keys(data).filter((k) => !isNote(k));

	return (
		<PageWrapper
			title="Balance Config"
			loading={store.loading}
			dirty={store.dirty}
			error={store.error}
			onLoad={handleLoad}
			onSave={handleSave}
			onUndo={store.undo}
		>
			{topLevelKeys.map((key) => {
				const value = data[key];
				if (!isPlainObject(value)) return null;
				return (
					<CollapsibleSection key={key} title={key}>
						<FieldEditor
							path={[key]}
							obj={value}
							onChange={handleFieldChange}
						/>
					</CollapsibleSection>
				);
			})}
		</PageWrapper>
	);
}
