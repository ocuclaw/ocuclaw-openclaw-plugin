import { serializeQrPayload } from "./qr-payload.js";

                                                          

export const ASSUMED_TERMINAL                       = Object.freeze({
  unicode: true,
  color: false,
  columns: 0,
});

export const PAIRING_BOOTSTRAP_FORBIDDEN_SUBSTRINGS                    = Object.freeze([
  "relayCredential",
  "relayToken",
  "credential:",
  "token=",
]);

export const NARROW_TERMINAL_COLUMNS = 76;

export const MANUAL_PAIRING_HEADING = "Manual pairing";

export const MANUAL_PAIRING_LEAD = "In OcuClaw tap Pair with your agent > Pair manually, then type:";

export function expiryClock(expiresInSeconds        )         {
  const total = Number.isFinite(expiresInSeconds) ? Math.max(0, Math.floor(expiresInSeconds)) : 0;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function manualPairingBlock(address        , pairingCode        , expiresInSeconds         )         {
  const known = typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds) && expiresInSeconds > 0;
  return [
    MANUAL_PAIRING_HEADING,
    MANUAL_PAIRING_LEAD,
    `  Address:      ${address}`,
    `  Pairing code: ${pairingCode}`,
    `Expires in ${known ? expiryClock(expiresInSeconds          ) : "a few minutes"}.`,
    "",
  ].join("\n");
}

export function renderPairingBootstrap(view                      )         {
  return manualPairingBlock(view.qrPayload.address, view.pairingCode, view.expiresInSeconds);
}

export function pairingBootstrapPayloadText(qrPayload                  )         {
  return serializeQrPayload(qrPayload);
}
