import * as alphaTab from '@coderline/alphatab';

type Score = alphaTab.model.Score;
type Settings = alphaTab.Settings;

export class AlphaTexParseError extends Error {
	constructor(
		message: string,
		readonly diagnostics: string[]
	) {
		super(message);
		this.name = 'AlphaTexParseError';
	}
}

export function defaultSettings(): Settings {
	return new alphaTab.Settings();
}

export function fromAlphaTex(tex: string, settings: Settings = defaultSettings()): Score {
	const importer = new alphaTab.importer.AlphaTexImporter();
	importer.initFromString(tex, settings);
	try {
		return importer.readScore();
	} catch (err) {
		// The useful detail is nested; the outer error is just "check diagnostics".
		const cause = (err as { cause?: { parserDiagnostics?: { items: { message: string }[] } } })
			.cause;
		const diagnostics = cause?.parserDiagnostics?.items.map((i) => i.message) ?? [];
		throw new AlphaTexParseError(diagnostics[0] ?? (err as Error).message, diagnostics);
	}
}

export function toAlphaTex(score: Score, settings: Settings = defaultSettings()): string {
	const bytes = new alphaTab.exporter.AlphaTexExporter().export(score, settings);
	return new TextDecoder().decode(bytes);
}
