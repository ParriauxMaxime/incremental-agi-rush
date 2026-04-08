import { useGameStore } from "@modules/game";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CodeToken } from "../data/code-tokens";
import { CODE_BLOCKS, tokenizeBlock } from "../data/code-tokens";

const EDITOR_STORAGE_KEY = "flopsed-editor";

interface EditorSaveState {
	blockIndex: number;
	tokenPos: number;
}

function loadEditorState(): EditorSaveState {
	try {
		const raw = localStorage.getItem(EDITOR_STORAGE_KEY);
		if (raw) return JSON.parse(raw) as EditorSaveState;
	} catch {}
	return { blockIndex: 0, tokenPos: 0 };
}

function saveEditorState(state: EditorSaveState) {
	localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(state));
}

export interface TypingState {
	lines: string[];
	currentLine: string;
}

// Cap how many tokens we visually advance per advanceTokens() call.
// LoC accounting still happens for all tokens, but we skip the string
// manipulation for tokens beyond this cap — they'll catch up next frame.
const MAX_VISUAL_TOKENS_PER_CALL = 60;

export function useCodeTyping() {
	const addLoc = useGameStore((s) => s.addLoc);
	const enqueueBlock = useGameStore((s) => s.enqueueBlock);

	const saved = useRef(loadEditorState());
	const blockIndexRef = useRef(saved.current.blockIndex);
	const currentBlockDef = useRef(
		CODE_BLOCKS[saved.current.blockIndex % CODE_BLOCKS.length],
	);
	const tokenQueueRef = useRef<CodeToken[]>(
		tokenizeBlock(currentBlockDef.current),
	);
	const tokenPosRef = useRef(saved.current.tokenPos);

	// Reconstruct partial typing state from saved position
	const initialTyping = useRef(() => {
		const tokens = tokenQueueRef.current;
		const lines: string[] = [];
		let currentLine = "";
		for (let i = 0; i < saved.current.tokenPos && i < tokens.length; i++) {
			const t = tokens[i];
			if (t.newline) {
				lines.push(currentLine);
				currentLine = "";
			} else {
				currentLine += t.html;
			}
		}
		return { lines, currentLine };
	});

	const [typing, setTyping] = useState<TypingState>(initialTyping.current);
	const typingLinesRef = useRef<string[]>(typing.lines);
	const typingCurrentRef = useRef(typing.currentLine);

	// ── Batched LoC accumulator ──
	// Instead of calling addLoc() per token, accumulate and flush every 150ms
	const pendingLocRef = useRef(0);
	useEffect(() => {
		const interval = setInterval(() => {
			if (pendingLocRef.current > 0) {
				addLoc(pendingLocRef.current);
				pendingLocRef.current = 0;
			}
		}, 150);
		return () => clearInterval(interval);
	}, [addLoc]);

	// Compute average loc-per-token ratio across ALL code blocks (stable value).
	// Recompute when locPerKey changes (from upgrades).
	const locPerKeyForRatio = useGameStore((s) => s.locPerKey);
	useEffect(() => {
		let totalLoc = 0;
		let totalTokens = 0;
		for (const block of CODE_BLOCKS) {
			const tokens = tokenizeBlock(block);
			totalLoc += block.loc;
			totalTokens += tokens.length;
		}
		const avgRatio = totalTokens > 0 ? totalLoc / totalTokens : 1;
		useGameStore.getState().setEffectiveLocPerKey(locPerKeyForRatio * avgRatio);
	}, [locPerKeyForRatio]);

	// ── Batched rendering ──
	// Throttle React state updates to ~20fps — fast enough to look smooth,
	// avoids expensive re-renders at high loc/s rates
	const dirtyRef = useRef(false);
	const flushTimerRef = useRef(0);
	const FLUSH_INTERVAL_MS = 50; // ~20fps for visual updates

	const flushTypingState = useCallback(() => {
		flushTimerRef.current = 0;
		dirtyRef.current = false;
		setTyping({
			lines: [...typingLinesRef.current],
			currentLine: typingCurrentRef.current,
		});
	}, []);

	const scheduleFlush = useCallback(() => {
		if (!dirtyRef.current) {
			dirtyRef.current = true;
			flushTimerRef.current = window.setTimeout(
				flushTypingState,
				FLUSH_INTERVAL_MS,
			);
		}
	}, [flushTypingState]);

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
		};
	}, []);

	const advanceTokens = useCallback(
		(count: number) => {
			let visualBudget = MAX_VISUAL_TOKENS_PER_CALL;

			for (let n = 0; n < count; n++) {
				const tokens = tokenQueueRef.current;
				const pos = tokenPosRef.current;

				if (pos >= tokens.length) {
					// Block complete — enqueue for execution
					const finalLines = [...typingLinesRef.current];
					if (typingCurrentRef.current) {
						finalLines.push(typingCurrentRef.current);
					}

					enqueueBlock({
						lines: finalLines,
						loc: currentBlockDef.current.loc,
					});

					blockIndexRef.current++;
					const nextBlock =
						CODE_BLOCKS[blockIndexRef.current % CODE_BLOCKS.length];
					currentBlockDef.current = nextBlock;
					tokenQueueRef.current = tokenizeBlock(nextBlock);
					tokenPosRef.current = 0;
					saveEditorState({
						blockIndex: blockIndexRef.current,
						tokenPos: 0,
					});
					typingLinesRef.current = [];
					typingCurrentRef.current = "";

					// Block completion flushes immediately (triggers queue update)
					if (flushTimerRef.current) {
						clearTimeout(flushTimerRef.current);
						flushTimerRef.current = 0;
					}
					dirtyRef.current = false;
					setTyping({ lines: [], currentLine: "" });
					continue;
				}

				// Accumulate LoC regardless of visual budget
				const locPerToken = currentBlockDef.current.loc / tokens.length;
				pendingLocRef.current += locPerToken;

				tokenPosRef.current = pos + 1;

				// Only do the expensive string work within visual budget
				if (visualBudget > 0) {
					visualBudget--;
					const token = tokens[pos];
					if (token.newline) {
						typingLinesRef.current.push(typingCurrentRef.current);
						typingCurrentRef.current = "";
					} else {
						typingCurrentRef.current += token.html;
					}
				}
			}

			// Single batched flush after all tokens processed
			scheduleFlush();
		},
		[enqueueBlock, scheduleFlush],
	);

	const advanceToken = useCallback(() => {
		advanceTokens(1);
	}, [advanceTokens]);

	// Periodic save
	useEffect(() => {
		const interval = setInterval(() => {
			saveEditorState({
				blockIndex: blockIndexRef.current,
				tokenPos: tokenPosRef.current,
			});
		}, 5000);
		return () => clearInterval(interval);
	}, []);

	return { typing, advanceToken, advanceTokens };
}
