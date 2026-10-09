const validationOrigin = "https://local-redirect.invalid";

/** Only accept same-site paths, never external URLs or ambiguous browser URLs. */
export function getPostLoginRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.length > 4096 ||
    value.trim() !== value ||
    /[\u0000-\u001f\u007f\\]/.test(value)
  ) return "/";

  try {
    const url = new URL(value, validationOrigin);
    const decodedPath = decodeURIComponent(url.pathname);
    if (
      url.origin !== validationOrigin ||
      decodedPath.startsWith("//") ||
      /[\u0000-\u001f\u007f\\]/.test(decodedPath)
    ) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}

export function getHandleSetupDestination(location: {
  pathname: string;
  search: string;
  hash: string;
}): string {
  if (location.pathname === "/choose-handle") {
    return getPostLoginRedirect(new URLSearchParams(location.search).get("redirectTo"));
  }
  return getPostLoginRedirect(location.pathname + location.search + location.hash);
}
