// Pure helpers for the hybrid-inference UI: mode bar, status line, on-device chip. No DOM, unit tested (test/mode.test.js).

export const HYBRID_TIP = "Lens prefers the private on-device model in your browser and falls back to the cloud when it is not ready.";

/** 3200 -> "3.2 s". Missing or bad input gives "". */
export function formatSeconds(ms) {
  const n = Number(ms);
  if (ms == null || !Number.isFinite(n) || n < 0) return "";
  return (n / 1000).toFixed(1) + " s";
}

/**
 * Describe the run that produced a result.
 * source: "on_device" | "in_cloud" (response.inferenceSource), deviceStatus: availability when the run started,
 * retried: an on-device answer was unusable and the cloud redid it.
 * Returns {mode, label, seconds, text, tip, sub}.
 */
export function modeInfo({ source, ms, deviceStatus, retried = false }) {
  const seconds = formatSeconds(ms);
  const onDevice = source === "on_device" && !retried;
  let label;
  let reason = "";
  if (onDevice) {
    label = "On-device (private)";
  } else {
    label = "Cloud";
    if (retried || deviceStatus === "available") reason = "on-device failed";
    else if (deviceStatus === "downloadable" || deviceStatus === "downloading") reason = "on-device not ready";
    if (reason) label += ` (${reason})`;
  }
  const tip = onDevice
    ? `${HYBRID_TIP} This answer came from the on-device model, so the page text stayed in your browser.`
    : `${HYBRID_TIP} This answer came from the cloud (Firebase AI Logic)${reason ? ": " + reason : ""}.`;
  return {
    mode: onDevice ? "on_device" : reason ? "cloud_fallback" : "cloud",
    label,
    seconds,
    text: seconds ? `${label} · ${seconds}` : label,
    tip,
    sub: onDevice ? "Your page text stayed in this browser." : "Hybrid AI: private on-device first, cloud as the fallback.",
  };
}

function statusName(info) {
  return info.mode === "on_device" ? "on-device (private)" : info.label;
}

/** "Done in 3.2 s on Cloud: 10 claims, 2 not found on the page. Click a claim to jump to it." */
export function statusLine({ totalMs, infos, claims, missing = 0 }) {
  const list = Array.isArray(infos) ? infos : [infos];
  const names = [...new Set(list.map(statusName))];
  const where = names.length > 1 ? "Cloud and on-device" : names[0];
  const secs = formatSeconds(totalMs);
  const join = where === "on-device (private)" ? "" : "on ";
  return `Done${secs ? " in " + secs : ""} ${join}${where}: ${claims} claim${claims === 1 ? "" : "s"}${missing ? `, ${missing} not found on the page` : ""}. Click a claim to jump to it.`;
}

/**
 * Map Chrome's LanguageModel availability (+ download progress 0..1 or null) to the chip.
 * Returns {kind, cls, text, tip, pct, showBar, canStart}.
 */
export function chipState(availability, progress = null) {
  const pct = progress == null || !Number.isFinite(progress) ? null : Math.round(Math.max(0, Math.min(1, progress)) * 100);
  switch (availability) {
    case "available":
      return { kind: "ready", cls: "chip chip-ready", text: "On-device model ready", tip: "The private on-device model is ready. Press Analyze (or Run again) to use it.", pct: null, showBar: false, canStart: false };
    case "downloading":
      return { kind: "downloading", cls: "chip chip-progress", text: pct == null ? "On-device model: downloading" : `On-device model: downloading ${pct}%`, tip: "The private on-device model is downloading. Lens uses the cloud until it is ready, then the next Analyze uses the on-device model.", pct, showBar: true, canStart: false };
    case "downloadable":
      return { kind: "downloadable", cls: "chip chip-neutral", text: "On-device model: not downloaded yet", tip: "One click starts a one-time download. Until it finishes, Lens uses the cloud.", pct: null, showBar: false, canStart: true };
    case "unavailable":
      return { kind: "unavailable", cls: "chip chip-cloud", text: "On-device not available on this device: using cloud", tip: "This device cannot run the on-device model, so Lens uses the cloud.", pct: null, showBar: false, canStart: false };
    case "checking":
      return { kind: "checking", cls: "chip chip-neutral", text: "Checking this browser...", tip: "Checking whether this browser can run the private on-device model", pct: null, showBar: false, canStart: false };
    default:
      return { kind: "unsupported", cls: "chip chip-cloud", text: "On-device not available in this browser: using cloud", tip: "This browser cannot run the on-device model, so Lens uses the cloud.", pct: null, showBar: false, canStart: false };
  }
}
