<section class="flex h-full items-center gap-2 p-3">
	{#each ['Track 1 — Guitar', 'Track 2 — Bass'] as label, i (label)}
		<button
			class="shrink-0 rounded px-3 py-1.5 text-xs font-medium {i === 0
				? 'bg-neutral-700 text-neutral-100'
				: 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-100'}"
		>
			{label}
		</button>
	{/each}
	<button
		class="shrink-0 rounded border border-dashed border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
	>
		+ Add track
	</button>
</section>
