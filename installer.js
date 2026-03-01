(async () => {
  const REPO_URL = "https://khysnik.github.io/93-repo/";
  const APP_KEY = "appstore";

  const sys42Ref =
    (typeof window !== "undefined" && window.sys42) ||
    (typeof window !== "undefined" && window.parent && window.parent.sys42) ||
    (typeof window !== "undefined" && window.top && window.top.sys42);

  if (!sys42Ref || !sys42Ref.fs || typeof sys42Ref.fs.write !== "function") {
    throw new Error("sys42.fs.write is not available");
  }

  const normalize = (s) => String(s || "").replace(/^\/+|\/+$/g, "");
  const repoBase = String(REPO_URL).replace(/\/+$/, "");

  const repoId = (() => {
    try {
      const u = new URL(repoBase);
      return `${u.host}${u.pathname}`.replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/\/+/g, "_");
    } catch {
      return repoBase.replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/\/+/g, "_");
    }
  })();

  const parseMaybeJSON5 = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      const cleaned = String(text)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
        .replace(/,\s*([}\]])/g, "$1");
      return JSON.parse(cleaned);
    }
  };

  const manifestText = await (await fetch(`${repoBase}/manifest.json`)).text();
  const repoManifest = parseMaybeJSON5(manifestText);

  const files = repoManifest?.[APP_KEY];
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error(`No files found for app "${APP_KEY}" in manifest.json`);
  }

  const installBase = `/c/programs/appstore/${repoId}/${APP_KEY}`;

  for (const file of files) {
    const rel = normalize(file);
    const src = `${repoBase}/${APP_KEY}/${rel}`;
    const dst = `${installBase}/${rel}`;

    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to fetch ${src} (${res.status})`);

    await sys42Ref.fs.write(dst, await res.text());
    console.log(`Installed: ${dst}`);
  }

  console.log(`Done. Installed "${APP_KEY}" to ${installBase}`);
})();