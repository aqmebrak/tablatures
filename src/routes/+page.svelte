<script lang="ts">
	import ScoreView from '$lib/components/ScoreView.svelte';

	const tex = `\\title "Untitled" \\tempo 180 . \\tuning e4 b3 g3 d3 a2 e2 . (0.6 0.5).8 3.6.8 5.6.16 | 7.6.4`;
</script>

<ScoreView {tex} />
