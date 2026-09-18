import * as alphaTab from '@coderline/alphatab';
import { resolveBeat, type CommandContext } from './types';

export type NoteArticulation =
  | 'palmMute'
  | 'deadNote'
  | 'ghost'
  | 'letRing'
  | 'staccato'
  | 'vibrato'
  | 'hammerPullOff';

export type BeatArticulation = 'tremoloPicking';

export function toggleNoteArticulation(ctx: CommandContext, kind: NoteArticulation): void {
  const beat = resolveBeat(ctx.score, ctx.cursor);
  const note = beat.notes.find((n) => n.string === ctx.cursor.stringNumber);
  if (!note) return;

  switch (kind) {
    case 'palmMute':
      note.isPalmMute = !note.isPalmMute;
      break;
    case 'deadNote':
      note.isDead = !note.isDead;
      break;
    case 'ghost':
      note.isGhost = !note.isGhost;
      break;
    case 'letRing':
      note.isLetRing = !note.isLetRing;
      break;
    case 'staccato':
      note.isStaccato = !note.isStaccato;
      break;
    case 'vibrato':
      note.vibrato =
        note.vibrato === alphaTab.model.VibratoType.Slight
          ? alphaTab.model.VibratoType.None
          : alphaTab.model.VibratoType.Slight;
      break;
    case 'hammerPullOff':
      note.isHammerPullOrigin = !note.isHammerPullOrigin;
      break;
  }

  ctx.score.finish(ctx.settings);
}

export function toggleBeatArticulation(ctx: CommandContext, kind: BeatArticulation): void {
  const beat = resolveBeat(ctx.score, ctx.cursor);
  if (kind === 'tremoloPicking') {
    beat.tremoloSpeed =
      beat.tremoloSpeed === null ? alphaTab.model.Duration.ThirtySecond : null;
  }
  ctx.score.finish(ctx.settings);
}
