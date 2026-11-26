import { spawn } from "node:child_process";
import process from "node:process";

try {
  process.loadEnvFile?.(".env.local");
} catch (error) {
  if (error?.code !== "ENOENT") {
    throw error;
  }
}

const baseUrl = "http://127.0.0.1:3100";
const nextCli = "node_modules/next/dist/bin/next";
const playwrightCli = "node_modules/@playwright/test/cli.js";

function run(command, argumentsList, environment = process.env) {
  return new Promise((resolve) => {
    const child = spawn(command, argumentsList, {
      env: environment,
      stdio: "inherit",
    });

    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function serverIsReady() {
  try {
    const response = await fetch(`${baseUrl}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServer(serverProcess) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await serverIsReady()) {
      return;
    }

    if (serverProcess.exitCode !== null) {
      throw new Error("The ReqDocs test server stopped before it became ready.");
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error("Timed out waiting for the ReqDocs test server.");
}

let serverProcess;
let ownsServer = false;

try {
  if (!(await serverIsReady())) {
    const buildExitCode = await run(process.execPath, [nextCli, "build"]);

    if (buildExitCode !== 0) {
      process.exitCode = buildExitCode;
      process.exit();
    }

    serverProcess = spawn(
      process.execPath,
      [nextCli, "start", "--port", "3100"],
      { stdio: "inherit" },
    );
    ownsServer = true;
    await waitForServer(serverProcess);
  }

  const testExitCode = await run(
    process.execPath,
    [playwrightCli, "test", ...process.argv.slice(2)],
    {
      ...process.env,
      REQDOCS_E2E_EXTERNAL_SERVER: "1",
    },
  );

  process.exitCode = testExitCode;
} catch (error) {
  console.error(error instanceof Error ? error.message : "E2E setup failed.");
  process.exitCode = 1;
} finally {
  if (ownsServer && serverProcess && serverProcess.exitCode === null) {
    serverProcess.kill("SIGTERM");
  }
}
