import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { getHandleSetupDestination, getPostLoginRedirect } from "../../shared/authRedirect";
import { postGoogleLogin } from "./postGoogleLogin";

function redirect(request: Record<string, unknown>) {
  const response = { redirect: vi.fn() };
  postGoogleLogin({
    isAuthenticated: () => true,
    ...request,
  } as unknown as Request, response as unknown as Response, vi.fn());
  return response.redirect;
}

describe("free access after Google sign-in", () => {
  it.each(["none", "expired", "cancelled", "trial", "active"])(
    "sends a %s account to the free directory without requesting card setup", status => {
      const user = { id: "fixture_user", subscriptionStatus: status, stripeCustomerId: null };
      const session = {};
      expect(redirect({ user, session })).toHaveBeenCalledWith("/");
      expect(user.subscriptionStatus).toBe(status);
      expect(user.stripeCustomerId).toBeNull();
    },
  );

  it("preserves a local chat destination and consumes it once", () => {
    const session: { postAuthRedirect?: string } = { postAuthRedirect: "/chat/123?invite=fixture#messages" };
    expect(redirect({ session })).toHaveBeenCalledWith("/chat/123?invite=fixture#messages");
    expect(session.postAuthRedirect).toBeUndefined();
    expect(redirect({ session })).toHaveBeenCalledWith("/");
  });

  it("preserves an explicitly selected paid feature rather than bypassing its guard", () => {
    expect(redirect({ session: { postAuthRedirect: "/create-agent" } })).toHaveBeenCalledWith("/create-agent");
    expect(redirect({ session: { postAuthRedirect: "/trial-signup" } })).toHaveBeenCalledWith("/trial-signup");
  });

  it("does not continue a requested private destination if authentication failed", () => {
    expect(redirect({
      isAuthenticated: () => false,
      session: { postAuthRedirect: "/chat/123" },
    })).toHaveBeenCalledWith("/");
  });

  it("handles a missing session safely", () => {
    expect(redirect({})).toHaveBeenCalledWith("/");
  });
});

describe("safe local login destinations", () => {
  it.each([
    undefined, null, ["/chat/123"], "https://evil.invalid", "//evil.invalid",
    "/\\evil.invalid", "/%5cevil.invalid", "/%2fevil.invalid",
    "/\n/evil.invalid", "javascript:alert(1)", "/%0d%0aevil.invalid",
    "/invalid%encoding", " /chat/123", "/chat/123\n",
  ])("rejects unsafe or malformed redirect %j", destination => {
    expect(getPostLoginRedirect(destination)).toBe("/");
    expect(redirect({ session: { postAuthRedirect: destination } })).toHaveBeenCalledWith("/");
  });

  it.each(["/", "/directory?q=music%20tutors", "/chat/123", "/invite?code=fixture", "/create-agent"])(
    "preserves local destination %s", destination => {
      expect(getPostLoginRedirect(destination)).toBe(destination);
    },
  );
});

describe("handle setup continuation", () => {
  it("defaults to the free directory instead of paid agent creation", () => {
    expect(getHandleSetupDestination({ pathname: "/", search: "", hash: "" })).toBe("/");
    expect(getHandleSetupDestination({ pathname: "/choose-handle", search: "", hash: "" })).toBe("/");
  });

  it("preserves the page interrupted by handle setup", () => {
    expect(getHandleSetupDestination({
      pathname: "/chat/123", search: "?invite=fixture", hash: "#messages",
    })).toBe("/chat/123?invite=fixture#messages");
  });

  it("continues an explicit handle-setup return path", () => {
    expect(getHandleSetupDestination({
      pathname: "/choose-handle", search: "?redirectTo=%2Fchat%2F123", hash: "",
    })).toBe("/chat/123");
  });

  it("does not allow handle setup to redirect off site", () => {
    expect(getHandleSetupDestination({
      pathname: "/choose-handle", search: "?redirectTo=https%3A%2F%2Fevil.invalid", hash: "",
    })).toBe("/");
  });
});
