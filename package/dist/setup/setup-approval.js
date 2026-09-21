import { createRelayPortApprovalHook } from "./relay-port-mutation.js";
import { createRelayCredentialApprovalHook } from "./relay-credential-provision.js";

export function createSetupApprovalHook() {
  const hooks = [createRelayPortApprovalHook(), createRelayCredentialApprovalHook()];
  return async function requireSetupApproval(event) {
    for (const hook of hooks) {
      const decision = await hook(event);
      if (decision) return decision;
    }
    return undefined;
  };
}
