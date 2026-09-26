import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("production build emits the CRM application shell", async () => {
  const html = await readFile(new URL("dist/index.html", root), "utf8");
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<title>Abroad Education Consultancy Services<\/title>/i);
  assert.match(html, /<div id="root"><\/div>/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|Building your site/i);
});

test("production HTML references build assets that exist", async () => {
  const html = await readFile(new URL("dist/index.html", root), "utf8");
  const assets = [...html.matchAll(/(?:src|href)="\/(assets\/[^"#?]+)"/g)].map(match => match[1]);
  assert.ok(assets.some(asset => asset.endsWith(".js")), "a JavaScript bundle must be linked");
  assert.ok(assets.some(asset => asset.endsWith(".css")), "a stylesheet bundle must be linked");
  await Promise.all(assets.map(asset => access(new URL(`dist/${asset}`, root))));
});
