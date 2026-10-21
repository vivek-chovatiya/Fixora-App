/**
 * NetworkStatusService
 *
 * The only route to whether the device is online (PROJECT_BIBLE.md section 49,
 * "Network error … allow Retry", and section 57's shared "Network Errors").
 *
 * It answers one question, in the app's own words: is the device offline? The
 * connectivity library's richer state — connection type, cellular generation,
 * wifi details — stays behind the implementation. Nothing in Phase 1 branches
 * on it, and offering it would invite a screen to start doing so.
 *
 * ⚠️ "Offline" means the platform has said so: no connection at all, or a
 * connection the platform has checked and found cannot reach the internet. An
 * answer that is not known yet counts as online. A probe that has not finished,
 * or cannot decide, must never put a warning in front of somebody whose
 * requests are working — a banner that cries wolf teaches people to ignore it.
 *
 * ⚠️ It reports; it never retries anything. Each screen keeps its own Try
 * again. A screen that reloaded itself on reconnect would join every other
 * mounted screen doing the same, and a connection that has just come back is
 * the worst moment for that burst.
 */

/** Whether the device can be expected to reach the internet right now. */
export interface NetworkState {
  readonly isOffline: boolean;
}

/** Told every time the platform reports a change. */
export type NetworkStateListener = (state: NetworkState) => void;

export interface NetworkStatusService {
  /** The state now. Resolves online when the platform does not know yet. */
  getCurrent(): Promise<NetworkState>;
  /**
   * Calls `listener` on every change the platform reports, until the returned
   * function is called. The listener may be called with the same state twice;
   * a caller that cares compares.
   */
  subscribe(listener: NetworkStateListener): () => void;
}
