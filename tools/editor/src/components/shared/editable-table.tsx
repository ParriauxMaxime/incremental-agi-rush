import { css } from "@emotion/react";
import { useMemo, useState } from "react";

export interface Column<T> {
	key: keyof T & string;
	label: string;
	width?: string;
	render?: (value: T[keyof T], row: T) => React.ReactNode;
	editable?: boolean;
	type?: "text" | "number" | "select";
	options?: string[];
}

interface EditableTableProps<T extends Record<string, unknown>> {
	data: T[];
	columns: Column<T>[];
	rowKey: (row: T) => string;
	onRowChange: (index: number, row: T) => void;
	onRowAdd?: () => void;
	onRowDelete?: (index: number) => void;
	filter?: string;
	groupBy?: (row: T) => string;
}

const tableWrapperStyle = css`
	display: flex;
	flex-direction: column;
	gap: 12px;
`;

const toolbarStyle = css`
	display: flex;
	gap: 10px;
	align-items: center;
`;

const searchStyle = css`
	background: #16213e;
	border: 1px solid #2a2a4a;
	border-radius: 4px;
	color: #ccd6f6;
	padding: 6px 10px;
	font-size: 13px;
	width: 240px;
	&:focus {
		outline: none;
		border-color: #64ffda;
	}
`;

const addButtonStyle = css`
	background: #2a2a4a;
	border: 1px solid #3a3a5a;
	border-radius: 4px;
	color: #64ffda;
	padding: 6px 14px;
	font-size: 13px;
	cursor: pointer;
	&:hover {
		background: #3a3a5a;
	}
`;

const tableStyle = css`
	width: 100%;
	border-collapse: collapse;
	font-size: 13px;
`;

const thStyle = css`
	text-align: left;
	padding: 8px 6px;
	color: #8892b0;
	font-weight: 500;
	border-bottom: 1px solid #2a2a4a;
	white-space: nowrap;
`;

const tdStyle = css`
	padding: 2px 4px;
	border-bottom: 1px solid #2a2a4a;
	vertical-align: middle;
`;

const rowStyle = css`
	&:hover {
		background: #16213e;
	}
`;

const groupHeaderStyle = css`
	td {
		padding: 12px 6px 6px;
		color: #64ffda;
		font-weight: 600;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		border-bottom: 1px solid #2a2a4a;
	}
`;

const cellInputStyle = css`
	width: 100%;
	background: transparent;
	border: 1px solid transparent;
	border-radius: 3px;
	color: #ccd6f6;
	padding: 4px 6px;
	font-size: 13px;
	font-family: inherit;
	box-sizing: border-box;
	&:focus {
		outline: none;
		border-color: #64ffda;
		background: #16213e;
	}
`;

const cellSelectStyle = css`
	${cellInputStyle}
	cursor: pointer;
	&:focus {
		border-color: #64ffda;
		background: #16213e;
	}
`;

const deleteButtonStyle = css`
	background: none;
	border: none;
	color: #555;
	cursor: pointer;
	font-size: 16px;
	padding: 2px 6px;
	border-radius: 3px;
	&:hover {
		color: #e74c3c;
		background: rgba(231, 76, 60, 0.1);
	}
`;

function matchesSearch(row: Record<string, unknown>, query: string): boolean {
	const lower = query.toLowerCase();
	return Object.values(row).some((v) =>
		String(v ?? "")
			.toLowerCase()
			.includes(lower),
	);
}

export function EditableTable<T extends Record<string, unknown>>({
	data,
	columns,
	rowKey,
	onRowChange,
	onRowAdd,
	onRowDelete,
	filter: externalFilter,
	groupBy,
}: EditableTableProps<T>) {
	const [search, setSearch] = useState(externalFilter ?? "");

	const filteredData = useMemo(() => {
		const query = search.trim();
		if (!query) return data.map((row, i) => ({ row, index: i }));
		return data
			.map((row, i) => ({ row, index: i }))
			.filter(({ row }) => matchesSearch(row, query));
	}, [data, search]);

	const grouped = useMemo(() => {
		if (!groupBy) return null;
		const groups: { label: string; items: { row: T; index: number }[] }[] = [];
		const map = new Map<string, { row: T; index: number }[]>();
		for (const item of filteredData) {
			const label = groupBy(item.row);
			let arr = map.get(label);
			if (!arr) {
				arr = [];
				map.set(label, arr);
				groups.push({ label, items: arr });
			}
			arr.push(item);
		}
		return groups;
	}, [filteredData, groupBy]);

	return (
		<div css={tableWrapperStyle}>
			<div css={toolbarStyle}>
				<input
					type="text"
					placeholder="Search..."
					css={searchStyle}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
				/>
				{onRowAdd && (
					<button type="button" css={addButtonStyle} onClick={onRowAdd}>
						+ Add
					</button>
				)}
			</div>
			<table css={tableStyle}>
				<thead>
					<tr>
						{columns.map((col) => (
							<th
								key={col.key}
								css={thStyle}
								style={col.width ? { width: col.width } : undefined}
							>
								{col.label}
							</th>
						))}
						{onRowDelete && (
							<th css={thStyle} style={{ width: "36px" }} />
						)}
					</tr>
				</thead>
				<tbody>
					{grouped
						? grouped.map((group) => (
								<GroupRows
									key={group.label}
									label={group.label}
									items={group.items}
									columns={columns}
									rowKey={rowKey}
									onRowChange={onRowChange}
									onRowDelete={onRowDelete}
								/>
							))
						: filteredData.map(({ row, index }) => (
								<DataRow
									key={rowKey(row)}
									row={row}
									index={index}
									columns={columns}
									onRowChange={onRowChange}
									onRowDelete={onRowDelete}
								/>
							))}
				</tbody>
			</table>
		</div>
	);
}

interface GroupRowsProps<T extends Record<string, unknown>> {
	label: string;
	items: { row: T; index: number }[];
	columns: Column<T>[];
	rowKey: (row: T) => string;
	onRowChange: (index: number, row: T) => void;
	onRowDelete?: (index: number) => void;
}

function GroupRows<T extends Record<string, unknown>>({
	label,
	items,
	columns,
	rowKey,
	onRowChange,
	onRowDelete,
}: GroupRowsProps<T>) {
	const colSpan = columns.length + (onRowDelete ? 1 : 0);
	return (
		<>
			<tr css={groupHeaderStyle}>
				<td colSpan={colSpan}>{label}</td>
			</tr>
			{items.map(({ row, index }) => (
				<DataRow
					key={rowKey(row)}
					row={row}
					index={index}
					columns={columns}
					onRowChange={onRowChange}
					onRowDelete={onRowDelete}
				/>
			))}
		</>
	);
}

interface DataRowProps<T extends Record<string, unknown>> {
	row: T;
	index: number;
	columns: Column<T>[];
	onRowChange: (index: number, row: T) => void;
	onRowDelete?: (index: number) => void;
}

function DataRow<T extends Record<string, unknown>>({
	row,
	index,
	columns,
	onRowChange,
	onRowDelete,
}: DataRowProps<T>) {
	return (
		<tr css={rowStyle}>
			{columns.map((col) => (
				<td key={col.key} css={tdStyle}>
					<CellEditor
						col={col}
						row={row}
						index={index}
						onRowChange={onRowChange}
					/>
				</td>
			))}
			{onRowDelete && (
				<td css={tdStyle}>
					<button
						type="button"
						css={deleteButtonStyle}
						onClick={() => onRowDelete(index)}
					>
						×
					</button>
				</td>
			)}
		</tr>
	);
}

interface CellEditorProps<T extends Record<string, unknown>> {
	col: Column<T>;
	row: T;
	index: number;
	onRowChange: (index: number, row: T) => void;
}

function CellEditor<T extends Record<string, unknown>>({
	col,
	row,
	index,
	onRowChange,
}: CellEditorProps<T>) {
	const value = row[col.key];

	if (col.render) {
		return <>{col.render(value, row)}</>;
	}

	if (!col.editable && col.type !== "select" && col.type !== "number") {
		return <span css={css`color: #8892b0; padding: 4px 6px;`}>{String(value ?? "")}</span>;
	}

	if (col.type === "select" && col.options) {
		return (
			<select
				css={cellSelectStyle}
				value={String(value ?? "")}
				onChange={(e) =>
					onRowChange(index, { ...row, [col.key]: e.target.value })
				}
			>
				{col.options.map((opt) => (
					<option key={opt} value={opt}>
						{opt}
					</option>
				))}
			</select>
		);
	}

	if (col.type === "number") {
		return (
			<input
				type="number"
				css={cellInputStyle}
				value={value === undefined || value === null ? "" : Number(value)}
				onChange={(e) =>
					onRowChange(index, {
						...row,
						[col.key]: e.target.value === "" ? 0 : Number(e.target.value),
					})
				}
			/>
		);
	}

	return (
		<input
			type="text"
			css={cellInputStyle}
			value={String(value ?? "")}
			onChange={(e) =>
				onRowChange(index, { ...row, [col.key]: e.target.value })
			}
		/>
	);
}
