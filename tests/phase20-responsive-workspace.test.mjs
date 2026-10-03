import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const main = read("src/main.tsx");
const responsive = read("src/styles/responsive-crm.css");
const shell = read("src/components/layout/AppShell.tsx");
const messages = read("src/features/messages/MessagesWorkspace.tsx");

assert.match(main, /import "\.\/styles\/responsive-crm\.css"/, "The shared responsive contract must load globally");
assert.match(responsive, /@media\(max-width:900px\)/, "Tablet navigation must have a dedicated breakpoint");
assert.match(responsive, /@media\(max-width:760px\)/, "Phone layouts must have a dedicated breakpoint");
assert.match(responsive, /@media\(max-width:480px\)/, "Small phones must collapse dense metric layouts");
assert.match(responsive, /safe-area-inset-(left|right|bottom)/, "iPhone safe areas must be respected");
assert.match(responsive, /font-size:16px/, "Mobile form controls must avoid iOS focus zoom");
assert.match(responsive, /overflow-x:auto/, "Wide records and tabs must remain horizontally reachable");
assert.match(responsive, /100dvh/, "Mobile overlays must fit the dynamic viewport");
assert.match(responsive, /min-height:44px/, "Touch controls must meet the mobile target contract");
assert.match(shell, /className="sidebar-mobile-close"/, "The mobile navigation drawer must expose a close control");
assert.match(messages, /mobileChatVisible/, "Messages must switch between the contact list and chat on phones");
assert.match(messages, /messenger-mobile-back/, "Mobile chat must provide a path back to conversations");

console.log("Phase 20 responsive workspace checks passed");
