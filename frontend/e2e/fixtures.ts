// Throw-away account for local end-to-end runs (unique per run).
export const testUser = {
  name: "Milane",
  email: `e2e-${Date.now()}@example.com`,
  password: `E2e-${Math.random().toString(36).slice(2)}-pw`,
};
