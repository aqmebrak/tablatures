<script lang="ts">
	import * as alphaTab from '@coderline/alphatab';
	import { onMount } from 'svelte';

	let { score, revision }: { score: alphaTab.model.Score; revision: number } = $props();
	let host: HTMLDivElement;
	let api: alphaTab.AlphaTabApi | undefined;

	onMount(() => {
		api = new alphaTab.AlphaTabApi(host, {
			core: { fontDirectory: '/font/' },
			display: { staveProfile: 'ScoreTab' }
		});
		api.renderScore(score, [0]);
		return () => api?.destroy();
	});

	// alphaTab does not observe mutations to the score object graph; every
	// command bumps `revision`, and this effect is what actually triggers a
	// re-render in response (AGENTS.md rule #4).
	$effect(() => {
		void revision;
		api?.renderScore(score, [0]);
	});
</script>

<div bind:this={host} data-testid="score-view" class="alphatab-host"></div>
