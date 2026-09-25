import { createRelayPortApprovalHook } from "./relay-port-mutation.js";
import { createRelayCredentialApprovalHook } from "./relay-credential-provision.js";

export function createSetupApprovalHook(extraHooks = []) {
  const hooks = [createRelayPortApprovalHook(), createRelayCredentialApprovalHook(),
    ...(Array.isArray(extraHooks) ? extraHooks : [])];
  return async function requireSetupApproval(event, ctx = undefined) {
    for (const hook of hooks) {
      const decision = await hook(event, ctx);
      if (decision) return decision;
    }
    return undefined;
  };
}
