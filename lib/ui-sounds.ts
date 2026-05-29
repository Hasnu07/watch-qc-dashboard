export type UiSound =
  | 'click'
  | 'nav'
  | 'chip'
  | 'success'
  | 'review'
  | 'expand'
  | 'error'
  | 'pop'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume()
  }
  return audioCtx
}

function playTone(
  frequency: number,
  duration: number,
  options?: {
    type?: OscillatorType
    volume?: number
    delay?: number
    detune?: number
  },
) {
  const ctx = getAudioContext()
  if (!ctx) return

  const {
    type = 'sine',
    volume = 0.07,
    delay = 0,
    detune = 0,
  } = options ?? {}

  const start = ctx.currentTime + delay
  const end = start + duration
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = type
  osc.frequency.value = frequency
  osc.detune.value = detune

  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0001), start + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, end)

  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(start)
  osc.stop(end + 0.02)
}

function playSequence(notes: Array<{ freq: number; at: number; dur: number; vol?: number }>) {
  for (const note of notes) {
    playTone(note.freq, note.dur, { volume: note.vol ?? 0.06, delay: note.at })
  }
}

export function playUiSound(sound: UiSound) {
  switch (sound) {
    case 'click':
      playTone(720, 0.05, { volume: 0.05, type: 'triangle' })
      break
    case 'nav':
      playSequence([
        { freq: 392, at: 0, dur: 0.06, vol: 0.045 },
        { freq: 523, at: 0.04, dur: 0.08, vol: 0.035 },
      ])
      break
    case 'chip':
      playTone(880, 0.04, { volume: 0.045, type: 'square' })
      playTone(660, 0.06, { volume: 0.025, delay: 0.02, type: 'sine' })
      break
    case 'success':
      playSequence([
        { freq: 523, at: 0, dur: 0.07, vol: 0.055 },
        { freq: 659, at: 0.06, dur: 0.07, vol: 0.05 },
        { freq: 784, at: 0.12, dur: 0.12, vol: 0.045 },
      ])
      break
    case 'review':
      playTone(440, 0.05, { volume: 0.05 })
      playTone(330, 0.1, { volume: 0.04, delay: 0.05, type: 'triangle' })
      break
    case 'expand':
      playTone(220, 0.08, { volume: 0.04, type: 'sine' })
      playTone(330, 0.1, { volume: 0.035, delay: 0.03 })
      break
    case 'error':
      playSequence([
        { freq: 220, at: 0, dur: 0.1, vol: 0.05 },
        { freq: 185, at: 0.08, dur: 0.14, vol: 0.045 },
      ])
      break
    case 'pop':
      playTone(1046, 0.03, { volume: 0.035, type: 'triangle' })
      break
    default:
      playTone(640, 0.05, { volume: 0.05 })
  }
}

export function detectClickSound(target: EventTarget | null): UiSound | null {
  if (!(target instanceof Element)) return null

  if (target.closest('.sound-toggle-btn')) return null

  const explicit = target.closest('[data-sound]') as HTMLElement | null
  if (explicit?.dataset.sound) {
    return explicit.dataset.sound as UiSound
  }

  const chip = target.closest('.pending-filter-chip')
  if (chip) return 'chip'

  const stripAction = target.closest('.task-strip-action')
  if (stripAction) {
    return stripAction.textContent?.trim().toLowerCase() === 'done' ? 'success' : 'review'
  }

  const strip = target.closest('.task-strip')
  if (strip) {
    if (strip.classList.contains('task-strip-overdue') || strip.classList.contains('task-strip-warning')) {
      return 'review'
    }
    return 'click'
  }

  const memberStrip = target.closest('.member-strip')
  if (memberStrip) return 'expand'

  const navLink = target.closest('nav a[href]')
  if (navLink) return 'nav'

  const interactive = target.closest('button, [role="button"], input[type="submit"], input[type="button"], label[for]')
  if (interactive) return 'click'

  return null
}
