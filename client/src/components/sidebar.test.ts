import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "./sidebar";

const route = vi.hoisted(() => ({ path: "/" }));

vi.mock("wouter", async () => {
  const ReactModule = await import("react");
  return {
    Link: ({ href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) =>
      ReactModule.createElement("a", { href, ...props }),
    useLocation: () => [route.path, () => {}] as const,
  };
});

function renderSidebar(isOpen: boolean, pathname = "/") {
  route.path = pathname;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const markup = renderToStaticMarkup(
    React.createElement(QueryClientProvider, { client },
      React.createElement(Sidebar, { isOpen, onToggle: () => {} })),
  );
  client.clear();
  return markup;
}

describe("mobile navigation regression", () => {
  it("renders 10words before More without unlocking the password-gated links", () => {
    const markup = renderSidebar(true);
    const tenWordsIndex = markup.indexOf(">10words</span>");
    const moreIndex = markup.indexOf(">More</span>");

    expect(tenWordsIndex).toBeGreaterThan(-1);
    expect(moreIndex).toBeGreaterThan(tenWordsIndex);
    expect(markup).toContain('href="/10words"');
    expect(markup).not.toContain(">My Brains</span>");
    expect(markup).toContain('aria-label="Primary navigation"');
  });

  it("anchors the drawer to the viewport and preserves its open/closed states", () => {
    const openMarkup = renderSidebar(true);
    const closedMarkup = renderSidebar(false);

    expect(openMarkup).toContain("fixed top-0 left-0");
    expect(openMarkup).toContain("h-[100dvh] lg:h-screen");
    expect(openMarkup).toContain("translate-x-0");
    expect(closedMarkup).toContain("-translate-x-full lg:translate-x-0");
    expect(openMarkup).toContain('aria-label="Close navigation menu"');
  });

  it("links to the test version while browsing test routes", () => {
    expect(renderSidebar(true, "/test/agents")).toContain('href="/test/10words"');
    expect(renderSidebar(true, "/test/10words/es")).toContain('href="/test/10words"');
  });
});
