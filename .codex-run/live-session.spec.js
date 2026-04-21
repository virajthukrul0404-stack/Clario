const { test, expect } = require("@playwright/test");
const { clerk } = require("@clerk/testing/playwright");

const sessionId = "cab8beb5-1f3e-4b76-a7d6-e9278ff266a0";
const teacherEmail = "codex.teacher.1776521579937@example.com";
const learnerEmail = "codex.learner.1776521579937@example.com";
const frontendApiUrl = "suitable-tiger-57.clerk.accounts.dev";

test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

async function signIn(page, email) {
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
  await clerk.signIn({
    page,
    emailAddress: email,
    setupClerkTestingTokenOptions: {
      frontendApiUrl,
    },
  });
}

function attachErrorCollectors(page, label, errors) {
  page.on("pageerror", (error) => {
    errors.push(`${label} pageerror: ${error.message}`);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(`${label} console: ${msg.text()}`);
    }
  });
}

test("live session flow", async ({ browser }) => {
  const errors = [];
  const messageText = `hello from teacher ${Date.now()}`;
  const teacherContext = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  const learnerContext = await browser.newContext({
    permissions: ["camera", "microphone"],
  });

  const teacherPage = await teacherContext.newPage();
  const learnerPage = await learnerContext.newPage();

  attachErrorCollectors(teacherPage, "teacher", errors);
  attachErrorCollectors(learnerPage, "learner", errors);

  await signIn(teacherPage, teacherEmail);
  await signIn(learnerPage, learnerEmail);

  const sessionApi = await teacherPage.evaluate(async (id) => {
    const response = await fetch(`/api/sessions/${id}`);
    return { status: response.status, data: await response.json() };
  }, sessionId);
  expect(sessionApi.status).toBe(200);
  expect(sessionApi.data.booking).toBeTruthy();
  expect(Array.isArray(sessionApi.data.messages)).toBeTruthy();

  const joinApi = await teacherPage.evaluate(async (id) => {
    const response = await fetch(`/api/sessions/${id}/join`, { method: "POST" });
    return { status: response.status, data: await response.json() };
  }, sessionId);
  expect(joinApi.status).toBe(200);
  expect(joinApi.data.roomIdentifier).toBeTruthy();

  const messagesApi = await teacherPage.evaluate(async (id) => {
    const response = await fetch(`/api/sessions/${id}/messages`);
    return { status: response.status, data: await response.json() };
  }, sessionId);
  expect(messagesApi.status).toBe(200);
  expect(Array.isArray(messagesApi.data)).toBeTruthy();

  await teacherPage.goto(`http://localhost:3000/session/${sessionId}`, {
    waitUntil: "domcontentloaded",
  });
  await learnerPage.goto(`http://localhost:3000/session/${sessionId}`, {
    waitUntil: "domcontentloaded",
  });

  await expect(teacherPage.locator("text=Chat")).toBeVisible({ timeout: 30000 });
  await expect(learnerPage.locator("text=Chat")).toBeVisible({ timeout: 30000 });
  await expect(teacherPage.locator("text=End session")).toBeVisible();
  await expect(learnerPage.locator("text=End session")).toBeVisible();

  await teacherPage.getByPlaceholder("Type a message...").fill(messageText);
  await teacherPage.getByRole("button", { name: "Send" }).click();

  await expect(teacherPage.getByText(messageText).last()).toBeVisible({ timeout: 10000 });
  await expect(learnerPage.getByText(messageText).last()).toBeVisible({ timeout: 10000 });

  await teacherPage.waitForFunction(() => {
    const remote = document.querySelectorAll("video")[0];
    return Boolean(remote && remote.srcObject);
  }, { timeout: 30000 });

  await learnerPage.waitForFunction(() => {
    const remote = document.querySelectorAll("video")[0];
    return Boolean(remote && remote.srcObject);
  }, { timeout: 30000 });

  const teacherConnected = await teacherPage.evaluate(() => {
    return !document.body.innerText.includes("Waiting for participant...");
  });
  const learnerConnected = await learnerPage.evaluate(() => {
    return !document.body.innerText.includes("Waiting for participant...");
  });
  expect(teacherConnected).toBeTruthy();
  expect(learnerConnected).toBeTruthy();

  await teacherPage.getByRole("button", { name: "Mic on" }).click();
  await expect(teacherPage.getByRole("button", { name: "Mic off" })).toBeVisible();
  const teacherMicEnabled = await teacherPage.evaluate(() => {
    const local = document.querySelectorAll("video")[1];
    const stream = local && local.srcObject;
    return stream?.getAudioTracks?.()[0]?.enabled ?? null;
  });
  expect(teacherMicEnabled).toBe(false);

  await teacherPage.getByRole("button", { name: "Cam on" }).click();
  await expect(teacherPage.getByRole("button", { name: "Cam off" })).toBeVisible();
  const teacherCamEnabled = await teacherPage.evaluate(() => {
    const local = document.querySelectorAll("video")[1];
    const stream = local && local.srcObject;
    return stream?.getVideoTracks?.()[0]?.enabled ?? null;
  });
  expect(teacherCamEnabled).toBe(false);

  await teacherPage.getByRole("button", { name: "End session" }).click();
  await teacherPage.waitForURL(
    (url) => url.pathname === "/dashboard" || url.pathname === "/teacher-dashboard",
    { timeout: 30000 }
  );

  expect(errors, errors.join("\n")).toEqual([]);

  await teacherContext.close();
  await learnerContext.close();
});
