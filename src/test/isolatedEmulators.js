// src/test/isolatedEmulators.js
// ─────────────────────────────────────────────────────────────────────────────
// WHAT THIS FILE DOES:
//   Safety guard for the integration tests. They DELETE data (all Auth users,
//   all Firestore documents, every file in the Storage bucket) between tests,
//   so they must only ever talk to the throwaway emulators started by
//
//     firebase emulators:exec --config firebase.test.json --project demo-togather-test ...
//
//   (see the test:integration:* scripts in package.json) — never to the
//   development emulators from `npm run start:emulators`, which hold your
//   test accounts and are exported to ./emulator-data on exit.
//
//   `emulators:exec` passes the running emulators' addresses to the tests in
//   environment variables. requireIsolatedEmulators() reads them and THROWS
//   (before any test or hook runs) when:
//     - they're missing (tests weren't started through emulators:exec),
//     - a service uses one of the development ports from firebase.json, or
//     - the project ID is not a "demo-" project, or is the real project.
//   Call it at the top level of an integration test file so a failure stops
//   the whole file from loading.
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import path from "node:path";

const ENV_VARS = {
  auth: "FIREBASE_AUTH_EMULATOR_HOST",
  firestore: "FIRESTORE_EMULATOR_HOST",
  storage: "FIREBASE_STORAGE_EMULATOR_HOST",
};

// Firebase CLI defaults for emulators/ports firebase.json doesn't set explicitly.
const CLI_DEFAULT_PORTS = [4000, 4400, 4500, 5000, 5001, 8080, 8085, 9000, 9099, 9150, 9199, 9299, 9499];

const HOW_TO_RUN =
  "Run integration tests with `npm run test:integration:auth`, " +
  "`npm run test:integration:firestore`, `npm run test:integration:storage` or `npm run test:all` — " +
  "they start separate, throwaway emulators (firebase.test.json). " +
  "They must never run against the development emulators from `npm run start:emulators`.";

const readJson = (file, root) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

/** Every port the development emulator setup (firebase.json) can listen on. */
export const getDevEmulatorPorts = (root = process.cwd()) => {
  const emulators = readJson("firebase.json", root).emulators || {};
  const ports = new Set(CLI_DEFAULT_PORTS);
  for (const cfg of Object.values(emulators)) {
    if (cfg && typeof cfg === "object") {
      if (Number.isInteger(cfg.port)) ports.add(cfg.port);
      if (Number.isInteger(cfg.websocketPort)) ports.add(cfg.websocketPort);
    }
  }
  return ports;
};

/** The real project ID from .firebaserc (what the development emulators use). */
export const getDevProjectId = (root = process.cwd()) => readJson(".firebaserc", root).projects?.default;

const parseHost = (value, envName) => {
  const match = /^(.+):(\d+)$/.exec(String(value).trim());
  if (!match) throw new Error(`Refusing to run integration tests: ${envName}="${value}" is not host:port. ${HOW_TO_RUN}`);
  return { host: match[1].replace(/^\[|\]$/g, ""), port: Number(match[2]) };
};

/**
 * Returns { projectId, auth?, firestore?, storage? } (each { host, port }) for
 * the requested services, or throws if they aren't the isolated test emulators.
 */
export const requireIsolatedEmulators = (services, { env = process.env, root = process.cwd() } = {}) => {
  if (!env.FIREBASE_EMULATOR_HUB) {
    throw new Error(`Refusing to run integration tests: no isolated emulators were started for this run. ${HOW_TO_RUN}`);
  }

  const projectId = env.GCLOUD_PROJECT;
  const devProjectId = getDevProjectId(root);
  if (!projectId || !projectId.startsWith("demo-") || projectId === devProjectId) {
    throw new Error(
      `Refusing to run integration tests: project "${projectId}" is not an isolated demo- project ` +
      `(the development project is "${devProjectId}"). ${HOW_TO_RUN}`
    );
  }

  const devPorts = getDevEmulatorPorts(root);
  if (devPorts.has(parseHost(env.FIREBASE_EMULATOR_HUB, "FIREBASE_EMULATOR_HUB").port)) {
    throw new Error(
      `Refusing to run integration tests: FIREBASE_EMULATOR_HUB=${env.FIREBASE_EMULATOR_HUB} is the development emulator hub. ${HOW_TO_RUN}`
    );
  }

  const result = { projectId };
  for (const service of services) {
    const envName = ENV_VARS[service];
    if (!envName) throw new Error(`Unknown emulator service "${service}".`);
    if (!env[envName]) {
      throw new Error(`Refusing to run integration tests: the ${service} emulator is not running (${envName} is not set). ${HOW_TO_RUN}`);
    }
    const address = parseHost(env[envName], envName);
    if (devPorts.has(address.port)) {
      throw new Error(
        `Refusing to run integration tests: ${envName}=${env[envName]} is a development emulator port. ${HOW_TO_RUN}`
      );
    }
    result[service] = address;
  }
  return result;
};
