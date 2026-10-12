/* Deterministischer PRNG (mulberry32) über state.rngState.
 * Alle Funktionen sind rein: sie geben den neuen Zustand zurück und verändern nichts. */

export function mulberry32(seed) {
  let t = (seed >>> 0) + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next: (seed + 0x6D2B79F5) >>> 0 };
}

/** Zufallszahl in [0, 1). */
export function nextFloat(rngState) {
  return mulberry32(rngState >>> 0);
}

/** Ganzzahl in [0, n). */
export function nextInt(rngState, n) {
  const r = mulberry32(rngState >>> 0);
  return { value: Math.floor(r.value * n), next: r.next };
}

/** Fisher-Yates-Mischung; gibt { arr, next } zurück (arr ist eine Kopie). */
export function shuffle(rngState, input) {
  const arr = input.slice();
  let s = rngState >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    const r = nextInt(s, i + 1);
    s = r.next;
    const j = r.value;
    const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return { arr, next: s };
}

/** Würfel: 1..sides */
export function roll(rngState, sides = 6) {
  const r = nextInt(rngState, sides);
  return { value: r.value + 1, next: r.next };
}
