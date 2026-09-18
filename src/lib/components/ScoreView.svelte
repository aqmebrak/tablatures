<script lang="ts">
	import * as alphaTab from '@coderline/alphatab';
	import { onMount } from 'svelte';

	let { tex }: { tex: string } = $props();
	let host: HTMLDivElement;
	let api: alphaTab.AlphaTabApi | undefined;

	onMount(() => {
		api = new alphaTab.AlphaTabApi(host, {
			core: { tex: true, fontDirectory: '/font/' },
			display: { staveProfile: 'ScoreTab' }
		});
		api.tex(tex);
		return () => api?.destroy();
	});
</script>

<div bind:this={host} data-testid="score-view" class="alphatab-host"></div>
