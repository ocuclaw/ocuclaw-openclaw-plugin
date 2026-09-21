import { OCUCLAW_SETUP_OPERATIONS } from "./setup-controller.js";
import { createFirstUseCommand } from "./first-use-command.js";
import { createOptionalCredentialCommand } from "./optional-credential-command.js";
import { createEvenAiSetupCommand } from "./even-ai-setup-command.js";
import { createOptionalDiagnosticsCommand } from "./optional-diagnostics-command.js";
import {
  CLOUDWAYS_VERBS,
  renderCloudwaysOutput,
  runCloudwaysVerb,
} from "./cloudways-command.js";
import { runCloudwaysSetup } from "./cloudways-setup.js";

import process from "node:process";

export function registerOcuClawSetupCli(api, controller, pair = null) {
  if (!api || typeof api.registerCli !== "function") return;
  if (typeof controller !== "function") {
    throw new Error("registerOcuClawSetupCli requires the setup controller");
  }

  api.registerCli(
    async ({ program }) => {
      const ocuclaw = program
        .command("ocuclaw")
        .description("Inspect OcuClaw setup and runtime state");
      ocuclaw.command("credential <capability>")
        .description("Privately save soniox or even-ai credentials in this host terminal")
        .option("--replace", "Deliberately replace this capability's existing credential")
        .action(async (capability, options) => {
          const result = await createOptionalCredentialCommand(api)(capability, options);
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          process.exitCode = result.exitCode;
        });
      const evenAi = ocuclaw.command("even-ai <action>")
        .description("Inspect, enable, propose a private route, or verify Even AI: status|enable|route|verify")
        .action(async (action) => {
          const result = await createEvenAiSetupCommand(api, controller)(action);
          evenAi.configureOutput().writeOut(`${JSON.stringify(result.report, null, 2)}\n`);
          process.exitCode = result.exitCode;
        });
      const diagnostics = ocuclaw.command("diagnostics [permission] [choice]")
        .description("Inspect diagnostics or change one permission: status|access allow|deny|handoff allow|deny")
        .action(async (permission, choice) => {
          const result = await createOptionalDiagnosticsCommand(api)(permission, choice);
          diagnostics.configureOutput().writeOut(`${JSON.stringify(result, null, 2)}\n`);
          process.exitCode = result.exitCode;
        });
      ocuclaw.command("first-use")
        .description("Resume this installation's first phone reply and confirm it appeared on G2")
        .option("--session <key>", "Bind the initial checkpoint to this phone conversation")
        .option("--retry", "Rearm unfinished first-use for a fresh phone reply; preserve completed setup")
        .option("--test-input", "Label an automated terminal exercise; never record real wearer acceptance")
        .action(async (options) => {
          const result = await createFirstUseCommand(api)(options);
          process.exitCode = result.exitCode;
        });
      for (const operation of OCUCLAW_SETUP_OPERATIONS) {
        const operationCommand = ocuclaw
          .command(operation)
          .description(`Print the redacted OcuClaw ${operation} result as JSON`);
        operationCommand.action(async function writeSetupResult() {
            const output = operationCommand.configureOutput();
            output.writeOut(
              `${JSON.stringify(await controller(operation, { surface: "cli" }), null, 2)}\n`,
            );
          });
      }

      const cloudways = ocuclaw
        .command("cloudways")
        .description("Manage the userspace Tailscale daemon on a Cloudways managed host");
      const CLOUDWAYS_DESCRIPTIONS = {
        detect: "Report whether this host is a Cloudways Managed AI Agents container",
        install: "Install the pinned userspace Tailscale binaries, state and host receipt",
        enroll: "Run tailscale up once and print the authorization link",
        status: "Report the daemon, receipt, supervisor and any foreign daemon",
        retry: "Observe the same enrollment and recover its authorization link",
        enable: "Resume supervision and start the daemon now",
        disable: "Pause supervision and stop the daemon",
        rollback: "Remove what this install created; keeps the Tailscale identity",
      };
      for (const verb of CLOUDWAYS_VERBS) {
        const verbCommand = cloudways
          .command(verb)
          .description(CLOUDWAYS_DESCRIPTIONS[verb])
          .option("--json", "Print the report as JSON instead of text");
        if (verb === "status") {
          verbCommand.option("--wait <seconds>", "Wait up to this many seconds for a settled daemon state");
        }
        if (verb === "enroll" || verb === "retry") {
          verbCommand.option("--hostname <name>", "Enroll a fresh identity under this tailnet node name");
          verbCommand.option("--wait <seconds>", "Total seconds to wait for the authorization link");
        }
        if (verb === "rollback") {
          verbCommand.option("--yes", "Confirm removal; without it rollback refuses");
          verbCommand.option("--purge-identity", "Also delete the Tailscale identity in ~/.tailscale");
        }
        verbCommand.action(async (options) => {
          const result = await runCloudwaysVerb(verb, options || {});
          verbCommand.configureOutput().writeOut(renderCloudwaysOutput(result, options || {}));
          process.exitCode = result.exitCode;
        });
      }

      cloudways
        .command("setup")
        .description("Run the whole Cloudways setup here: Tailscale, the private route, pairing and the first message")
        .option("--yes", "Answer both consent questions with yes; for automation. Never confirms G2")
        .option("--details", "Print the exact settings and commands behind each consent question")
        .option("--wait <seconds>", "Seconds to wait for tailnet authorization (default 600)")
        .option("--first-use-wait <seconds>", "Seconds to wait for the first phone reply (default 600)")
        .option("--no-pair", "Stop after the private route instead of pairing a phone")
        .option("--no-first-use", "Stop after pairing instead of confirming the first message")
        .option("--test-input", "Label an automated terminal exercise; never record real wearer acceptance")
        .option("--light-terminal", "Render the pairing QR for a light terminal background")
        .option("--hostname <name>", "Enroll a fresh identity under this tailnet node name")
        .action(async (options) => {
          const result = await runCloudwaysSetup(options || {}, {
            api, controller, pair, firstUse: createFirstUseCommand(api),
          });
          process.exitCode = result.exitCode;
        });
      if (typeof pair === "function") {
        ocuclaw.command("pair")
          .description("Pair a phone directly in this terminal using QR or Manual and four safety words")
          .option("--light-terminal", "Render the QR for a light terminal background")
          .action(async (options) => {
            const result = await pair(options);
            process.exitCode = result.exitCode;
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
