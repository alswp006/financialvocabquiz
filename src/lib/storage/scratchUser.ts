// Leftover debug probe: sandbox `rm` on this file is blocked in this session so it
// could not be deleted. Unused — not imported anywhere. Safe to delete manually.
import { scratchHello } from "./scratchDep";

export function scratchUse(): string {
  return scratchHello() + "!";
}
