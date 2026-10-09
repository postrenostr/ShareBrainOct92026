import { describe, it, expect } from "vitest";
import { build } from "esbuild";
import puppeteer from "puppeteer";
import path from "node:path";
import { existsSync } from "node:fs";

describe.skipIf(process.env.TEN_WORDS_BROWSER_TESTS !== "1")("10words client-key browser flow", () => {
  it("creates, displays once, rotates, revokes and reports failures with isolated API fixtures", async () => {
    const bundle = await build({
      stdin: {
        contents: `import React from "react"; import { createRoot } from "react-dom/client";
          import TenWordsKeys from "./client/src/components/ten-words-keys";
          createRoot(document.getElementById("root")).render(<TenWordsKeys />);`,
        resolveDir: process.cwd(), loader: "tsx",
      },
      bundle: true, write: false, platform: "browser", jsx: "automatic",
      alias: { "@": path.resolve("client/src") },
      define: { "process.env.NODE_ENV": '"production"' },
    });
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
      (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);
    const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844 });
      await page.setRequestInterception(true);
      const fixtureKey = `tw_${"a".repeat(64)}`;
      const rotatedKey = `tw_${"b".repeat(64)}`;
      const id = "da403209-1ddc-4cc7-bd09-af6f09ecbc0b";
      let clients: any[] = [];
      let failCreate = false;
      let failList = false;
      let requests = 0;
      page.on("request", async request => {
        const url = new URL(request.url());
        if (url.hostname !== "key-fixture.test") { await request.abort(); return; }
        if (url.pathname === "/") {
          await request.respond({ status: 200, contentType: "text/html", body: '<!doctype html><div id="root"></div>' });
          return;
        }
        if (!url.pathname.startsWith("/api/10words/clients")) { await request.abort(); return; }
        requests++;
        let status = 200;
        let data: unknown;
        if (request.method() === "GET") {
          if (failList) { status = 503; data = { message: "Client keys could not be loaded." }; }
          else data = { clients };
        } else if (url.pathname.endsWith("/rotate")) {
          clients[0] = { ...clients[0], keyPrefix: rotatedKey.slice(0, 11) };
          data = { key: rotatedKey, client: clients[0] };
        } else if (url.pathname.endsWith("/revoke")) {
          clients[0] = { ...clients[0], revokedAt: new Date().toISOString() };
          data = clients[0];
        } else if (failCreate) {
          status = 503; data = { message: "Client key could not be created." };
        } else {
          const body = JSON.parse(request.postData() || "{}");
          clients = [{ id, name: body.name, scopes: body.scopes, rateLimit: body.rateLimit,
            usageCount: 0, lastUsedAt: null, revokedAt: null, keyPrefix: fixtureKey.slice(0, 11) }];
          data = { key: fixtureKey, client: clients[0] }; status = 201;
        }
        await request.respond({ status, contentType: "application/json", headers: { "Cache-Control": "no-store" }, body: JSON.stringify(data) });
      });
      await page.goto("https://key-fixture.test");
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.waitForSelector('input[maxlength="80"]');
      expect(await page.evaluate(() => document.body.textContent?.includes("Keys from the general API Portal do not work here"))).toBe(true);
      await page.type('input[maxlength="80"]', "Voice app");
      async function clickButton(text: string) {
        await page.evaluate(label => {
          const button = [...document.querySelectorAll("button")].find(item => item.textContent === label);
          if (!button) throw new Error("Expected button was not rendered.");
          button.click();
        }, text);
      }
      async function waitForText(text: string) {
        await page.waitForFunction(value => document.body.textContent?.includes(value), {}, text);
      }
      await clickButton("Create client key");
      await waitForText("Save this key now.");
      expect(await page.$eval("code", element => element.textContent === `tw_${"a".repeat(64)}`)).toBe(true);
      await clickButton("I’ve saved it");
      expect((await page.$$("code")).length).toBe(0);
      page.on("dialog", dialog => dialog.accept());
      await clickButton("Rotate");
      await waitForText("Save this key now.");
      expect(await page.$eval("code", element => element.textContent === `tw_${"b".repeat(64)}`)).toBe(true);
      await clickButton("I’ve saved it");
      await clickButton("Revoke");
      await waitForText("Revoked");
      expect(await page.evaluate(() => [...document.querySelectorAll("button")].some(button => button.textContent === "Rotate"))).toBe(false);
      failCreate = true;
      await clickButton("Create client key");
      await waitForText("Client key could not be created.");
      expect((await page.$$("code")).length).toBe(0);
      failCreate = false; failList = true;
      await clickButton("Create client key");
      await waitForText("Client keys could not be loaded.");
      // A successful issue must remain visible even when refreshing the list fails.
      expect((await page.$$("code")).length).toBe(1);
      expect(requests).toBeGreaterThanOrEqual(8);
    } finally { await browser.close(); }
  }, 30000);
});
