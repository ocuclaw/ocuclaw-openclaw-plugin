import { OCUCLAW_SETUP_OPERATIONS } from "./setup-controller.js";

export function registerOcuClawSetupCli(api, controller) {
  if (!api || typeof api.registerCli !== "function") return;
  if (typeof controller !== "function") {
    throw new Error("registerOcuClawSetupCli requires the setup controller");
  }

  api.registerCli(
    async ({ program }) => {
      const ocuclaw = program
        .command("ocuclaw")
        .description("Inspect OcuClaw setup and runtime state");
      for (const operation of OCUCLAW_SETUP_OPERATIONS) {
        const operationCommand = ocuclaw
          .command(operation)
          .description(`Print the redacted OcuClaw ${operation} result as JSON`);
        operationCommand.action(async function writeSetupResult() {
            const output = operationCommand.configureOutput();
            output.writeOut(
              `${JSON.stringify(controller(operation, { surface: "cli" }), null, 2)}\n`,
            );
          });
      }
    },
    {
      descriptors: [
        {
          name: "ocuclaw",
          description: "Inspect OcuClaw setup and runtime state",
          hasSubcommands: true,
        },
      ],
    },
  );
}
