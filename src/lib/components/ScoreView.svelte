<script lang="ts">
	import * as alphaTab from '@coderline/alphatab';
	import { onMount } from 'svelte';
	import { resolveBeat } from '$lib/score/commands/types';
	import type { Cursor } from '$lib/score/cursor';

	let {
		score,
		revision,
		cursor
	}: { score: alphaTab.model.Score; revision: number; cursor: Cursor } = $props();
	let host: HTMLDivElement;
	let api: alphaTab.AlphaTabApi | undefined;
	let highlightStyle = $state('display: none;');

	function updateHighlight() {
		if (!api?.boundsLookup) {
			highlightStyle = 'display: none;';
			return;
		}
		let beat: alphaTab.model.Beat;
		try {
			beat = resolveBeat(score, cursor);
		} catch {
			highlightStyle = 'display: none;';
			return;
		}
		const bounds = api.boundsLookup.findBeat(beat);
		if (!bounds) {
			highlightStyle = 'display: none;';
			return;
		}
		const { x, y, w, h } = bounds.visualBounds;
		highlightStyle = `left: ${x}px; top: ${y}px; width: ${w}px; height: ${h}px;`;
	}

	onMount(() => {
		api = new alphaTab.AlphaTabApi(host, {
			core: { fontDirectory: '/font/' },
			display: { staveProfile: 'ScoreTab' }
		});
		api.renderScore(score, [0]);
		// Reposition the highlight after every (re-)layout — a revision-driven
		// re-render, or a window resize that alphaTab re-lays-out on its own.
		// `postRenderFinished` (not `renderFinished`) is the point at which
		// boundsLookup is finalized; on resize, renderFinished fires with stale
		// bounds (measured: ~16px horizontal drift).
		api.postRenderFinished.on(() => updateHighlight());
		return () => api?.destroy();
	});

	// alphaTab does not observe mutations to the score object graph; every
	// command bumps `revision`, and this effect is what actually triggers a
	// re-render in response (AGENTS.md rule #4).
	$effect(() => {
		void revision;
		api?.renderScore(score, [0]);
	});

	// Pure cursor movement (no score mutation, so no revision bump — see
	// editorStore.run()) still needs the highlight to move, so this is
	// tracked independently of `revision`.
	$effect(() => {
		void cursor;
		updateHighlight();
	});
</script>

<div class="relative">
	<div bind:this={host} data-testid="score-view" class="alphatab-host"></div>
	<div class="cursor-highlight" style={highlightStyle} data-testid="cursor-highlight"></div>
</div>

<style>
	.cursor-highlight {
		position: absolute;
		pointer-events: none;
		border-radius: 2px;
		background: rgba(250, 204, 21, 0.35);
		border: 2px solid rgba(250, 204, 21, 0.9);
		animation: cursor-pulse 1s ease-in-out infinite;
	}

	@keyframes cursor-pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}
</style>
