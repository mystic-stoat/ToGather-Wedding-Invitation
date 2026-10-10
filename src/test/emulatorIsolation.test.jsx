// Regression tests: integration tests must never run against the DEVELOPMENT
// emulators (npm run start:emulators), whose Auth users, Firestore data and
// uploaded photos are exported to ./emulator-data on exit. Integration tests
// wipe all three, so they run on separate throwaway emulators (firebase.test.json)
// and refuse to start otherwise. Runs in the unit suite — no emulators needed.
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { requireIsolatedEmulators, getDevEmulatorPorts, getDevProjectId } from "./isolatedEmulators";

const root = process.cwd();
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(root, f), "utf8"));
const devConfig = readJson("firebase.json");
const testConfig = readJson("firebase.test.json");
const scripts = readJson("package.json").scripts;
const devPorts = getDevEmulatorPorts(root);
const devProject = getDevProjectId(root);

const INTEGRATION_FILES = fs.readdirSync(path.join(root, "src/test"))
  .filter((f) => /\.integration\.test\.jsx?$/.test(f));

// What `firebase emulators:exec --config firebase.test.json` hands the tests
const TEST_ENV = {
  FIREBASE_EMULATOR_HUB: "127.0.0.1:14400",
  GCLOUD_PROJECT: "demo-togather-test",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:19099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:18080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:19199",
};
const ALL = ["auth", "firestore", "storage"];

// ─────────────────────────────────────────────────────────────────────────────
describe("requireIsolatedEmulators guard", () => {
  it("accepts the isolated test emulators", () => {
    expect(requireIsolatedEmulators(ALL, { env: TEST_ENV })).toEqual({
      projectId: "demo-togather-test",
      auth: { host: "127.0.0.1", port: 19099 },
      firestore: { host: "127.0.0.1", port: 18080 },
      storage: { host: "127.0.0.1", port: 19199 },
    });
  });

  it("refuses to run when no isolated emulators were started (plain `vitest run`)", () => {
    expect(() => requireIsolatedEmulators(ALL, { env: {} })).toThrow(/no isolated emulators/);
  });

  it("refuses when a required emulator is missing", () => {
    const { FIREBASE_STORAGE_EMULATOR_HOST, ...noStorage } = TEST_ENV;
    expect(() => requireIsolatedEmulators(["storage"], { env: noStorage })).toThrow(/storage emulator is not running/);
  });

  it.each([
    ["FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099", "auth"],
    ["FIREBASE_AUTH_EMULATOR_HOST", "localhost:9099", "auth"],
    ["FIRESTORE_EMULATOR_HOST", "127.0.0.1:8080", "firestore"],
    ["FIREBASE_STORAGE_EMULATOR_HOST", "127.0.0.1:9199", "storage"],
  ])("refuses the development port %s=%s", (name, value, service) => {
    expect(() => requireIsolatedEmulators([service], { env: { ...TEST_ENV, [name]: value } }))
      .toThrow(/development emulator port/);
  });

  it("refuses the development emulator hub", () => {
    expect(() => requireIsolatedEmulators(ALL, { env: { ...TEST_ENV, FIREBASE_EMULATOR_HUB: "127.0.0.1:4400" } }))
      .toThrow(/development emulator hub/);
  });

  it.each([[devProject], ["some-real-project"], [undefined]])(
    "refuses project %s (only demo- projects, never the real one)",
    (project) => {
      expect(() => requireIsolatedEmulators(ALL, { env: { ...TEST_ENV, GCLOUD_PROJECT: project } }))
        .toThrow(/not an isolated demo- project/);
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
describe("firebase.test.json — isolated emulators", () => {
  const services = ["auth", "firestore", "storage", "hub", "logging"];

  it("gives every emulator an explicit port that the development setup never uses", () => {
    const used = [];
    for (const s of services) {
      const port = testConfig.emulators[s]?.port;
      expect(Number.isInteger(port), `${s} port`).toBe(true);
      used.push(port);
    }
    used.push(testConfig.emulators.firestore.websocketPort);
    for (const port of used) expect(devPorts.has(port), `port ${port}`).toBe(false);
    expect(new Set(used).size).toBe(used.length); // no clashes with each other
  });

  it("has the Emulator UI off and never imports or exports data", () => {
    expect(testConfig.emulators.ui).toEqual({ enabled: false });
    const raw = JSON.stringify(testConfig);
    expect(raw).not.toMatch(/import|export/i);
  });

  it("uses the same security rules files as the development setup", () => {
    expect(testConfig.firestore.rules).toBe(devConfig.firestore.rules);
    expect(testConfig.storage.rules).toBe(devConfig.storage.rules);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("package.json scripts", () => {
  it("leaves the development emulator command unchanged", () => {
    expect(scripts["start:emulators"]).toBe(
      "firebase emulators:start --export-on-exit=./emulator-data --import=./emulator-data --only functions,firestore,auth,storage"
    );
  });

  it.each([
    ["test:integration:auth", "integration:auth", ["auth", "firestore"]],
    ["test:integration:firestore", "integration:firestore", ["firestore"]],
    ["test:integration:storage", "integration:storage", ["firestore", "storage"]],
    ["test:all", "all", ["auth", "firestore", "storage"]],
  ])("%s runs on throwaway isolated emulators", (name, vitestProject, emulators) => {
    const script = scripts[name];
    expect(script.startsWith("firebase emulators:exec ")).toBe(true);
    expect(script).toContain("--config firebase.test.json");
    expect(script).toMatch(/--project demo-[a-z0-9-]+/);
    expect(script).not.toContain(`--project ${devProject}`);
    expect(script).not.toMatch(/--import|--export-on-exit|emulator-data/);
    expect(script).toContain(`--only ${emulators.join(",")} `);
    expect(script).toMatch(new RegExp(`"vitest run --project ${vitestProject}"$`));
  });

  it("every script that runs integration tests goes through the isolated emulators", () => {
    const runsIntegration = Object.entries(scripts)
      .filter(([, cmd]) => /vitest/.test(cmd) && /--project (integration|all)\b/.test(cmd));
    expect(runsIntegration.length).toBeGreaterThan(0);
    for (const [name, cmd] of runsIntegration) {
      expect(cmd, name).toMatch(/^firebase emulators:exec --config firebase\.test\.json --project demo-/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("integration test files", () => {
  it("finds the integration suites", () => {
    expect(INTEGRATION_FILES.sort()).toEqual([
      "Login.integration.test.jsx",
      "firestoreRules.integration.test.jsx",
      "storageRules.integration.test.jsx",
    ]);
  });

  it.each(INTEGRATION_FILES)("%s checks for isolated emulators before any hook and has no hard-coded dev target", (file) => {
    const src = fs.readFileSync(path.join(root, "src/test", file), "utf8");
    const guard = src.search(/^const EMULATORS = requireIsolatedEmulators\(/m);
    expect(guard, "top-level requireIsolatedEmulators call").toBeGreaterThan(-1);
    const firstHook = src.search(/^(beforeAll|beforeEach|afterEach|afterAll|describe)\(/m);
    expect(guard).toBeLessThan(firstHook);

    // No hard-coded development ports or project ID used as a target
    expect(src).not.toMatch(/\b(port|PORT)\s*[:=]\s*(9099|8080|9199)\b/);
    expect(src).not.toMatch(/['"`](127\.0\.0\.1|localhost):(9099|8080|9199)/);
    expect(src).not.toMatch(/PROJECT_ID\s*=\s*['"`]/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("vite.config.js", () => {
  it("stops src/lib/firebase.js from connecting to the development emulators during integration runs", () => {
    // Read as text: importing the config under jsdom trips esbuild's TextEncoder check.
    const src = fs.readFileSync(path.join(root, "vite.config.js"), "utf8").replace(/\r/g, "");
    const blocks = src.split(/name:\s*'/).slice(1).map((b) => ({ name: b.slice(0, b.indexOf("'")), body: b }));
    const nonUnit = blocks.filter((b) => b.name !== "unit");
    expect(nonUnit.map((b) => b.name).sort())
      .toEqual(["all", "integration:auth", "integration:firestore", "integration:storage"]);
    for (const b of nonUnit) expect(b.body, b.name).toMatch(/env:\s*\{\s*VITE_RUN_EMULATOR_MODE:\s*'false'\s*\}/);
  });
});
