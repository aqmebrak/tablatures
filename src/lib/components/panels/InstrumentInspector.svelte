<section class="p-3">
	<h2 class="mb-2 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Instrument</h2>
	<div class="flex flex-col gap-3">
		<label class="flex flex-col gap-1 text-xs text-neutral-400">
			Instrument
			<select class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100">
				<option>Guitar</option>
				<option>Bass</option>
				<option>Drums</option>
			</select>
		</label>

		<label class="flex flex-col gap-1 text-xs text-neutral-400">
			Strings
			<select class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100">
				{#each [4, 5, 6, 7, 8] as count (count)}
					<option>{count}</option>
				{/each}
			</select>
		</label>

		<label class="flex flex-col gap-1 text-xs text-neutral-400">
			Tuning
			<select class="rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100">
				<option>Standard</option>
			</select>
		</label>
	</div>
</section>
