import type { Command } from '../sim/core/Commands';
import type { Simulation } from '../sim/Simulation';

/**
 * Command transport. Local play delivers commands straight into the simulation; the LAN
 * implementation (lockstep over WebSocket) will stamp commands with a future tick and deliver
 * them only once every peer has confirmed that tick.
 */
export interface CommandTransport {
  readonly latencyTicks: number;
  send(cmd: Command): void;
}

export class LocalTransport implements CommandTransport {
  readonly latencyTicks = 0;
  readonly log: { tick: number; cmd: Command }[] = [];
  constructor(private sim: () => Simulation) {}
  send(cmd: Command): void { const s = this.sim(); this.log.push({ tick: s.tick, cmd }); s.enqueue(cmd, s.tick); }
}
