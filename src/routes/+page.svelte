<script lang="ts">
	import ScoreView from '$lib/components/ScoreView.svelte';
	import TransportBar from '$lib/components/TransportBar.svelte';
	import NotationPalette from '$lib/components/panels/NotationPalette.svelte';
	import InstrumentInspector from '$lib/components/panels/InstrumentInspector.svelte';
	import TrackList from '$lib/components/panels/TrackList.svelte';

	const tex = `\\title "Untitled" \\tempo 120 . \\tuning e4 b3 g3 d3 a2 e2 . r.1`;
</script>

<div class="flex h-screen flex-col bg-neutral-900 text-neutral-100">
	<TransportBar />
	<div class="flex min-h-0 flex-1">
		<aside class="w-56 shrink-0 overflow-y-auto border-r border-neutral-800" data-testid="palette">
			<NotationPalette />
		</aside>
		<main class="min-w-0 flex-1 overflow-auto bg-neutral-100" data-testid="score-pane">
			<ScoreView {tex} />
		</main>
		<aside
			class="w-72 shrink-0 overflow-y-auto border-l border-neutral-800"
			data-testid="inspector"
		>
			<InstrumentInspector />
		</aside>
	</div>
	<footer class="h-32 shrink-0 overflow-y-auto border-t border-neutral-800" data-testid="tracks">
		<TrackList />
	</footer>
</div>
