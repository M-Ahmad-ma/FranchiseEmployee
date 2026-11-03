/**
 * Lightweight navigation/load timing, dev only.
 *
 * The API logger tells you how long a request took; this tells you how long it
 * took from the drawer tap until the screen actually mounted and started its
 * fetch. Comparing the two separates UI/navigation work from server time.
 */

/** Turn off when the timing investigation is finished. */
export const LOG_PERF = true;

let drawerTapAt: number | null = null;
let drawerTapTarget: string | null = null;

function stamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(
    now.getMilliseconds(),
  ).padStart(3, '0')}`;
}

function write(label: string, detail?: string) {
  if (!LOG_PERF || !__DEV__) {
    return;
  }
  const sinceDrawer =
    drawerTapAt === null ? '' : ` | drawer+${Date.now() - drawerTapAt}ms`;
  console.log(
    `[perf ${stamp()}] ${label}${sinceDrawer}${detail ? ` | ${detail}` : ''}`,
  );
}

/** Call immediately before navigating from the drawer. */
export function markDrawerNavigation(target: string) {
  drawerTapAt = Date.now();
  drawerTapTarget = target;
  write(`drawer tap → ${target}`);
}

/** Logs how long after the drawer tap this screen event happened. */
export function logScreenEvent(label: string, detail?: string) {
  write(label, detail);
}

export function startTimer(): number {
  return Date.now();
}

export function finishTimer(
  label: string,
  startedAt: number,
  detail?: string,
) {
  const elapsed = Date.now() - startedAt;
  write(`${label} took ${elapsed}ms`, detail);
}

export function drawerTarget(): string | null {
  return drawerTapTarget;
}
