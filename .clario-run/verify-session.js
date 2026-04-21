const { chromium } = require("playwright");
const { createClerkClient } = require("@clerk/backend");

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function createSignInUrl(userId) {
  const token = await clerk.signInTokens.createSignInToken({
    userId,
    expiresInSeconds: 60,
  });
  return token.url;
}

async function signIn(page, userId) {
  const signInUrl = await createSignInUrl(userId);
  await page.goto(signInUrl, { waitUntil: "domcontentloaded" });
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 45000 });
  return page.url();
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  });

  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  const page = await context.newPage();

  page.on("console", (msg) => console.log("BROWSER_CONSOLE", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("PAGE_ERROR", err.message));

  try {
    const signedInUrl = await signIn(
      page,
      "user_3CXAXau0L4UUfD2SioeoClkNkHv"
    );
    console.log("SIGNED_IN_URL", signedInUrl);

    await page.goto("http://localhost:3000/session/cab8beb5-1f3e-4b76-a7d6-e9278ff266a0", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("text=Chat", { timeout: 30000 });

    console.log("SESSION_URL", page.url());
    console.log("HAS_CHAT", await page.locator("text=Chat").count());
    console.log("HAS_END", await page.locator("text=End session").count());
    console.log("BODY_TEXT", await page.locator("body").innerText());
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
