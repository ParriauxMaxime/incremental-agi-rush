import { css } from "@emotion/react";
import type {
	TechTreeNode as TechNode,
	TechNodeEffect,
} from "@flopsed/design-system";
import { useState } from "react";

interface NodeInspectorProps {
	node: TechNode;
	allNodeIds: string[];
	onChange: (node: TechNode) => void;
	onClose: () => void;
	onDelete: () => void;
}

const EFFECT_TYPES = [
	"locPerKey",
	"autoLoc",
	"freelancerLoc",
	"internLoc",
	"devLoc",
	"teamLoc",
	"managerLoc",
	"llmLoc",
	"agentLoc",
	"flops",
	"cpuFlops",
	"ramFlops",
	"storageFlops",
	"locProductionSpeed",
	"cashMultiplier",
	"tokenMultiplier",
	"devSpeed",
	"freelancerLocMultiplier",
	"internLocMultiplier",
	"devLocMultiplier",
	"teamLocMultiplier",
	"managerMultiplier",
	"llmLocMultiplier",
	"agentLocMultiplier",
	"freelancerCostDiscount",
	"internCostDiscount",
	"devCostDiscount",
	"teamCostDiscount",
	"managerCostDiscount",
	"llmCostDiscount",
	"agentCostDiscount",
	"freelancerMaxBonus",
	"internMaxBonus",
	"teamMaxBonus",
	"managerMaxBonus",
	"llmMaxBonus",
	"agentMaxBonus",
	"llmHostSlot",
	"tierUnlock",
	"modelUnlock",
	"autoType",
	"autoPoke",
	"autoArbitrage",
	"singularity",
];

const EFFECT_OPS = ["add", "multiply", "set", "enable"];
const CURRENCY_OPTIONS = ["cash", "loc"];

const panelStyle = css`
	width: 300px;
	background: #16213e;
	border-left: 1px solid #2a2a4a;
	padding: 16px;
	overflow-y: auto;
	flex-shrink: 0;
	display: flex;
	flex-direction: column;
	gap: 12px;
`;

const headerStyle = css`
	display: flex;
	justify-content: space-between;
	align-items: center;
`;

const titleStyle = css`
	font-size: 16px;
	font-weight: 600;
	color: #ccd6f6;
`;

const closeBtnStyle = css`
	background: none;
	border: none;
	color: #8892b0;
	cursor: pointer;
	font-size: 18px;
	&:hover { color: #ccd6f6; }
`;

const fieldStyle = css`
	display: flex;
	flex-direction: column;
	gap: 4px;
`;

const labelStyle = css`
	font-size: 12px;
	color: #8892b0;
	font-weight: 500;
`;

const inputStyle = css`
	background: #0a0f1e;
	border: 1px solid #2a2a4a;
	border-radius: 4px;
	color: #ccd6f6;
	padding: 6px 10px;
	font-size: 13px;
	&:focus { outline: none; border-color: #64ffda; }
`;

const textareaStyle = css`
	${inputStyle}
	resize: vertical;
	min-height: 60px;
	font-family: inherit;
`;

const selectStyle = css`
	${inputStyle}
	cursor: pointer;
`;

const tagListStyle = css`
	display: flex;
	flex-wrap: wrap;
	gap: 4px;
`;

const tagStyle = css`
	background: #2a2a4a;
	color: #ccd6f6;
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 12px;
	display: flex;
	align-items: center;
	gap: 4px;
`;

const tagRemoveStyle = css`
	background: none;
	border: none;
	color: #e74c3c;
	cursor: pointer;
	font-size: 14px;
	padding: 0;
	line-height: 1;
`;

const deleteBtnStyle = css`
	background: #e74c3c;
	color: white;
	border: none;
	border-radius: 6px;
	padding: 8px 16px;
	cursor: pointer;
	font-size: 13px;
	margin-top: 8px;
	&:hover { background: #c0392b; }
`;

const sectionTitleStyle = css`
	font-size: 13px;
	font-weight: 600;
	color: #8892b0;
	margin-top: 4px;
`;

const effectRowStyle = css`
	display: flex;
	gap: 4px;
	align-items: center;
`;

const effectSelectStyle = css`
	${inputStyle}
	flex: 1;
	min-width: 0;
	font-size: 11px;
	padding: 4px 6px;
`;

const effectValueStyle = css`
	${inputStyle}
	width: 60px;
	font-size: 11px;
	padding: 4px 6px;
`;

const effectRemoveStyle = css`
	background: none;
	border: none;
	color: #e74c3c;
	cursor: pointer;
	font-size: 16px;
	padding: 0 2px;
`;

const addBtnStyle = css`
	background: #2a2a4a;
	color: #64ffda;
	border: none;
	border-radius: 4px;
	padding: 4px 12px;
	cursor: pointer;
	font-size: 12px;
	&:hover { background: #3a3a5a; }
`;

function RequiresEditor({
	requires,
	allNodeIds,
	nodeId,
	onChange,
}: {
	requires: string[];
	allNodeIds: string[];
	nodeId: string;
	onChange: (requires: string[]) => void;
}) {
	const available = allNodeIds
		.filter((id) => id !== nodeId && !requires.includes(id))
		.sort((a, b) => a.localeCompare(b));

	return (
		<div css={fieldStyle}>
			<span css={labelStyle}>Requires</span>
			<div css={tagListStyle}>
				{requires.map((req) => (
					<span key={req} css={tagStyle}>
						{req}
						<button
							type="button"
							css={tagRemoveStyle}
							onClick={() => onChange(requires.filter((r) => r !== req))}
						>
							x
						</button>
					</span>
				))}
			</div>
			{available.length > 0 && (
				<select
					css={selectStyle}
					value=""
					onChange={(e) => {
						if (e.target.value) onChange([...requires, e.target.value]);
					}}
				>
					<option value="">+ Add dependency</option>
					{available.map((id) => (
						<option key={id} value={id}>
							{id}
						</option>
					))}
				</select>
			)}
		</div>
	);
}

function EffectsEditor({
	effects,
	onChange,
}: {
	effects: TechNodeEffect[];
	onChange: (effects: TechNodeEffect[]) => void;
}) {
	const updateEffect = (idx: number, patch: Partial<TechNodeEffect>) => {
		const next = [...effects];
		next[idx] = { ...next[idx], ...patch };
		onChange(next);
	};

	const removeEffect = (idx: number) => {
		onChange(effects.filter((_, i) => i !== idx));
	};

	const addEffect = () => {
		onChange([...effects, { type: "locPerKey", op: "add", value: 1 }]);
	};

	return (
		<div css={fieldStyle}>
			<span css={sectionTitleStyle}>Effects</span>
			{effects.map((effect, idx) => (
				<div key={`effect-${idx}`} css={effectRowStyle}>
					<select
						css={effectSelectStyle}
						value={effect.type}
						onChange={(e) => updateEffect(idx, { type: e.target.value })}
					>
						{EFFECT_TYPES.map((t) => (
							<option key={t} value={t}>
								{t}
							</option>
						))}
					</select>
					<select
						css={effectSelectStyle}
						value={effect.op}
						onChange={(e) => updateEffect(idx, { op: e.target.value })}
					>
						{EFFECT_OPS.map((o) => (
							<option key={o} value={o}>
								{o}
							</option>
						))}
					</select>
					<input
						css={effectValueStyle}
						value={String(effect.value)}
						onChange={(e) => {
							const numVal = Number(e.target.value);
							const value = Number.isNaN(numVal) ? e.target.value : numVal;
							updateEffect(idx, { value });
						}}
					/>
					<button
						type="button"
						css={effectRemoveStyle}
						onClick={() => removeEffect(idx)}
					>
						x
					</button>
				</div>
			))}
			<button type="button" css={addBtnStyle} onClick={addEffect}>
				+ Add Effect
			</button>
		</div>
	);
}

export function NodeInspector({
	node,
	allNodeIds,
	onChange,
	onClose,
	onDelete,
}: NodeInspectorProps) {
	const set = (patch: Partial<TechNode>) => onChange({ ...node, ...patch });

	return (
		<div css={panelStyle}>
			<div css={headerStyle}>
				<span css={titleStyle}>Node Inspector</span>
				<button type="button" css={closeBtnStyle} onClick={onClose}>
					x
				</button>
			</div>

			<div css={fieldStyle}>
				<label css={labelStyle}>ID</label>
				<input
					css={inputStyle}
					value={node.id}
					onChange={(e) => set({ id: e.target.value })}
				/>
			</div>

			<div css={fieldStyle}>
				<label css={labelStyle}>Name</label>
				<input
					css={inputStyle}
					value={node.name}
					onChange={(e) => set({ name: e.target.value })}
				/>
			</div>

			<div css={fieldStyle}>
				<label css={labelStyle}>Description</label>
				<textarea
					css={textareaStyle}
					value={node.description}
					onChange={(e) => set({ description: e.target.value })}
				/>
			</div>

			<div css={fieldStyle}>
				<label css={labelStyle}>Icon</label>
				<input
					css={inputStyle}
					value={node.icon}
					onChange={(e) => set({ icon: e.target.value })}
				/>
			</div>

			<div css={fieldStyle}>
				<label css={labelStyle}>Currency</label>
				<select
					css={selectStyle}
					value={node.currency}
					onChange={(e) => set({ currency: e.target.value })}
				>
					{CURRENCY_OPTIONS.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
			</div>

			<div css={fieldStyle}>
				<label css={labelStyle}>Base Cost</label>
				<input
					css={inputStyle}
					type="number"
					value={node.baseCost}
					onChange={(e) => set({ baseCost: Number(e.target.value) })}
				/>
			</div>

			<div css={fieldStyle}>
				<label css={labelStyle}>Cost Multiplier</label>
				<input
					css={inputStyle}
					type="number"
					step="0.01"
					value={node.costMultiplier}
					onChange={(e) => set({ costMultiplier: Number(e.target.value) })}
				/>
			</div>

			<div css={fieldStyle}>
				<label css={labelStyle}>Max</label>
				<input
					css={inputStyle}
					type="number"
					value={node.max}
					onChange={(e) => set({ max: Number(e.target.value) })}
				/>
			</div>

			<RequiresEditor
				requires={node.requires ?? []}
				allNodeIds={allNodeIds}
				nodeId={node.id}
				onChange={(requires) => set({ requires })}
			/>

			<EffectsEditor
				effects={node.effects ?? []}
				onChange={(effects) => set({ effects })}
			/>

			<JsonView node={node} />

			<button type="button" css={deleteBtnStyle} onClick={onDelete}>
				Delete Node
			</button>
		</div>
	);
}

// ── JSON view ──

const jsonToggleStyle = css`
	background: none;
	border: none;
	color: #8892b0;
	cursor: pointer;
	font-size: 13px;
	font-weight: 600;
	padding: 0;
	display: flex;
	align-items: center;
	gap: 6px;
	&:hover { color: #ccd6f6; }
`;

const jsonPreStyle = css`
	background: #0a0f1e;
	border: 1px solid #2a2a4a;
	border-radius: 4px;
	padding: 10px 12px;
	font-size: 12px;
	font-family: 'Courier New', monospace;
	color: #ccd6f6;
	overflow-x: auto;
	white-space: pre;
	max-height: 400px;
	overflow-y: auto;
	line-height: 1.5;
	margin-top: 6px;
`;

function JsonView({ node }: { node: TechNode }) {
	const [open, setOpen] = useState(false);

	// Build a clean object without x/y (layout-only fields)
	const { ...rest } = node;
	const json = JSON.stringify(rest, null, 2);

	return (
		<div css={fieldStyle}>
			<button
				type="button"
				css={jsonToggleStyle}
				onClick={() => setOpen(!open)}
			>
				<span style={{ fontSize: 10, width: 12 }}>{open ? "▾" : "▸"}</span>
				JSON
			</button>
			{open && <pre css={jsonPreStyle}>{json}</pre>}
		</div>
	);
}
