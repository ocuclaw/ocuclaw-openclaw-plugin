import { canonicalizeRelayAddressV1 } from "./relay-address.js";

export const PAIRING_ENDPOINT_PATH = "/_ocuclaw/pair/v1";

export const PAIRING_ENDPOINT_CONTENT_TYPE = "application/json";

export const PAIRING_MAX_REQUEST_BODY_BYTES = 4096;

export const PAIRING_CONTROL_MAX_REQUEST_BODY_BYTES = 4096;

export function pairingEndpointUrlForRelayAddress(canonicalAddress        )                {
  const prefix = "wss://";
  if (typeof canonicalAddress !== "string" || !canonicalAddress.startsWith(prefix)) {
    return null;
  }

  const checked = canonicalizeRelayAddressV1(canonicalAddress);
  if (!checked.ok) return null;

  if (checked.address !== canonicalAddress) return null;
  const authority = checked.address.slice(prefix.length);
  return `https://${authority}${PAIRING_ENDPOINT_PATH}`;
}

export function isPairingEndpointPath(pathname        )          {
  return pathname === PAIRING_ENDPOINT_PATH;
}

export const PAIRING_CONTROL_PATH = "/_ocuclaw/pair/control/v1";

export function isPairingControlPath(pathname        )          {
  return pathname === PAIRING_CONTROL_PATH;
}
