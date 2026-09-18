<section class="p-3">
	<h2 class="mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Duration</h2>
	<div class="grid grid-cols-4 gap-1">
		{#each ['1', '2', '4', '8', '16', '32', '.', '3'] as label (label)}
			<button class="rounded bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-700">{label}</button>
		{/each}
	</div>

	<h2 class="mt-4 mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">
		Articulation
	</h2>
	<div class="grid grid-cols-2 gap-1">
		{#each ['P.M.', 'Dead', 'Ghost', 'Let ring', 'H/P', 'Slide', 'Bend', 'Vibrato', 'Tremolo'] as label (label)}
			<button class="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700">{label}</button>
		{/each}
	</div>
</section>
