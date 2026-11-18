import { parentPort, workerData } from "node:worker_threads";
import { convertModel } from "./model-convert.js";

const WORKER_MARKER = "ocuclawModelConvertWorker";

if (parentPort && workerData && workerData[WORKER_MARKER]) {
  const port = parentPort;
  port.once("message", async (message     ) => {
    const result = await convertModel(message.input, message.limits || {});
    port.postMessage(result, result.ok ? [result.mesh.buffer               ] : []);
  });
}
