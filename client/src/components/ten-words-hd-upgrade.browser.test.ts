import { describe, it, expect } from "vitest";
import { build } from "esbuild";
import puppeteer, { type Page } from "puppeteer";
import path from "node:path";
import { existsSync } from "node:fs";
import type { HdUpgradeStatus } from "@shared/tenWordsHdUpgrade";

describe.skipIf(process.env.TEN_WORDS_BROWSER_TESTS !== "1")("HD upgrade control with isolated API fixtures", () => {
  it("requires explicit actions, retries only unsuccessful work, and never auto-resumes", async () => {
    const bundle = await build({
      stdin: { contents: `import React from "react"; import {createRoot} from "react-dom/client";
        import Upgrade from "./client/src/components/ten-words-hd-upgrade";
        const root=createRoot(document.getElementById("root"));
        window.unmountUpgrade=()=>root.unmount();
        root.render(<Upgrade />);`,
        resolveDir: process.cwd(), loader: "tsx" },
      bundle: true, write: false, platform: "browser", jsx: "automatic",
      alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared") },
      define: { "process.env.NODE_ENV": '"production"' },
    });
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH ||
      (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);
    const browser = await puppeteer.launch({ executablePath, headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    let state: HdUpgradeStatus = { job: null, items: [], environment: "production", existingLessons: 2,
      counts: { total: 0, pending: 0, running: 0, complete: 0, failed: 0, conflict: 0 } };
    const mutations: string[] = [];
    let failSecond = true;
    let denied = false;
    let holdStep = false;
    let releaseStep: (() => void) | undefined;
    let abortNext = false;
    let deniedRequests = 0;
    function recount() {
      state.counts = { total: state.items.length, pending: 0, running: 0, complete: 0, failed: 0, conflict: 0 };
      for (const item of state.items) state.counts[item.status]++;
    }
    async function mount() {
      const page = await browser.newPage();
      await page.setViewport({ width: 390, height: 844 });
      await page.setRequestInterception(true);
      page.on("request", async req => {
        const url = new URL(req.url());
        if (url.hostname !== "hd-fixture.test") { await req.abort(); return; }
        if (url.pathname === "/") {
          await req.respond({ status: 200, contentType: "text/html", body: '<!doctype html><div id="root"></div>' }); return;
        }
        if (!url.pathname.startsWith("/api/10words/hd-upgrade")) { await req.abort(); return; }
        if (denied) {
          deniedRequests++;
          await req.respond({ status: 403, contentType: "application/json", body: '{"message":"Admin access required"}' }); return;
        }
        if (req.method() === "POST") {
          const operation = url.pathname.split("/").at(-1)!;
          mutations.push(operation);
          if (abortNext) { abortNext = false; await req.abort(); return; }
          const body = JSON.parse(req.postData() || "{}");
          if (operation === "start") {
            expect(body).toEqual({ confirmation: "UPGRADE SAVED AUDIO" });
            state.job = { id: "tts-1-hd-alloy-v1", createdAt: new Date().toISOString() };
            state.items = [1, 2].map(lessonNumber => ({ language: "es", lessonNumber, status: "pending", attempts: 0, message: null }));
          } else if (operation === "retry") {
            expect(body).toEqual({ confirmation: "RETRY UNSUCCESSFUL AUDIO" });
            state.items.filter(item => item.status !== "complete").forEach(item => { item.status = "pending"; });
            failSecond = false;
          } else if (operation === "step") {
            if (holdStep) await new Promise<void>(resolve => { releaseStep = resolve; });
            const item = state.items.find(item => item.status === "pending");
            if (item) {
              item.attempts++;
              item.status = failSecond && item.lessonNumber === 2 ? "failed" : "complete";
              item.message = item.status === "failed" ? "Provider failed; original audio preserved." : null;
            }
          }
          recount();
        }
        await req.respond({ status: 200, contentType: "application/json",
          headers: { "Cache-Control": "no-store" }, body: JSON.stringify(state) });
      });
      await page.goto("https://hd-fixture.test");
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      return page;
    }
    async function click(page: Page, label: string) {
      await page.evaluate(text => {
        const button = [...document.querySelectorAll("button")].find(item => item.textContent?.includes(text));
        if (!button || button.disabled) throw new Error(`Button unavailable: ${text}`);
        button.click();
      }, label);
    }
    async function text(page: Page, value: string) {
      await page.waitForFunction(expected => document.body.textContent?.includes(expected), {}, value);
    }
    try {
      const page = await mount();
      await text(page, "2 saved lessons are available");
      expect(mutations).toHaveLength(0);
      expect(await page.$eval("#hd-start-confirmation", input => input.getAttribute("autocomplete"))).toBe("off");
      await page.type("#hd-start-confirmation", "UPGRADE SAVED AUDIO");
      await click(page, "Start upgrade");
      await text(page, "Provider failed; original audio preserved.");
      await page.waitForFunction(() => !document.body.textContent?.includes("Stop after current"));
      expect(mutations).toEqual(["start", "step", "step"]);
      await click(page, "Refresh status");
      await page.waitForFunction(() => [...document.querySelectorAll("button")]
        .some(button => button.textContent?.includes("Refresh status") && !button.disabled));
      expect(mutations).toHaveLength(3);
      await page.type("#hd-retry-confirmation", "RETRY UNSUCCESSFUL AUDIO");
      await click(page, "Retry unsuccessful audio");
      await text(page, "HD audio maintenance is complete");
      expect(mutations).toEqual(["start", "step", "step", "retry", "step"]);
      expect(state.items.map(item => item.attempts)).toEqual([1, 2]);
      await page.close();
      const completed = await mount();
      await text(completed, "All saved lesson audio is complete");
      expect(await completed.$("#hd-start-confirmation")).toBeNull();
      expect(await completed.$("#hd-retry-confirmation")).toBeNull();
      expect(mutations).toHaveLength(5);
      await completed.close();

      // Stop after current request and reload: pending work requires another action.
      state.items.forEach(item => { item.status = "pending"; }); recount();
      holdStep = true;
      const stopped = await mount();
      await text(stopped, "Continue pending lessons");
      await click(stopped, "Continue pending lessons");
      await text(stopped, "Stop after current");
      await stopped.waitForFunction(() => document.body.textContent?.includes("Stop after current"));
      // Wait for the intercepted request, not a timing guess.
      while (!releaseStep) await new Promise(resolve => setTimeout(resolve, 10));
      await click(stopped, "Stop after current");
      releaseStep(); releaseStep = undefined; holdStep = false;
      await text(stopped, "Stopped after the current server request finishes");
      expect(state.counts.pending).toBe(1);
      const afterStop = mutations.length;
      await stopped.close();
      const resumed = await mount();
      await text(resumed, "Continue pending lessons");
      expect(mutations).toHaveLength(afterStop);
      // Lost POST response: read status, never repeat the paid request automatically.
      abortNext = true;
      await click(resumed, "Continue pending lessons");
      await text(resumed, "Review it before choosing another action");
      expect(mutations).toHaveLength(afterStop + 1);
      await resumed.close();

      denied = true;
      const hidden = await mount();
      while (!deniedRequests) await new Promise(resolve => setTimeout(resolve, 10));
      await hidden.waitForFunction(() => !document.querySelector("#hd-upgrade-heading"));
      expect(await hidden.$("#hd-start-confirmation")).toBeNull();
      expect(mutations).toHaveLength(afterStop + 1);
      await hidden.close();
    } finally {
      releaseStep?.();
      await browser.close();
    }
  }, 45000);
});
