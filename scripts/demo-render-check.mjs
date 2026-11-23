// T2970: opens Wayback URLs in a real Chromium (normal UA), reports whether the archive toolbar covers a probe text, saves docs/demo/t2970-archive-<name>.png.
//   node scripts/demo-render-check.mjs '[["name","https://web.archive.org/web/...","probe text"]]'
import { chromium } from "playwright-core";
import { readdirSync, existsSync } from "node:fs"; import { join } from "node:path"; import os from "node:os";
const base = join(os.homedir(), "AppData/Local/ms-playwright");
const exe = readdirSync(base).filter(d=>/^chromium-\d+$/.test(d)).sort().reverse().map(d=>join(base,d,"chrome-win64/chrome.exe")).find(existsSync);
const UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const pages = JSON.parse(process.argv[2]);
const b = await chromium.launch({ executablePath: exe, headless: true });
for (const [name,url,probe] of pages) {
  const ctx = await b.newContext({ userAgent: UA, viewport:{width:1280,height:800} });
  const p = await ctx.newPage(); const t0=Date.now(); let st="";
  try { const r = await p.goto(url,{waitUntil:"load",timeout:60000}); st=r.status(); } catch(e){ st="ERR "+e.message.slice(0,80); }
  const loadMs=Date.now()-t0; await p.waitForTimeout(3000);
  const info = await p.evaluate((probe)=>{
    const tb=document.querySelector("#wm-ipp-base, #wm-ipp"); const r=tb?.getBoundingClientRect();
    const out={toolbar: r?{top:r.top,height:r.height,pos:getComputedStyle(tb).position}:null, textLen:document.body.innerText.length};
    const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT); let n; out.probe=[];
    while((n=w.nextNode())){ if(n.textContent.includes(probe)){ const rg=document.createRange(); rg.selectNodeContents(n); const q=rg.getBoundingClientRect(); const el=document.elementFromPoint(q.left+Math.min(q.width,20)/2+1,q.top+q.height/2); out.probe.push({y:Math.round(q.top),visibleInTop800:q.top<800&&q.top>=0,coveredByToolbar:!!el?.closest("#wm-ipp-base,#wm-ipp,#wm-ipp-print"),hitTag:el?.tagName}); break; } }
    out.cookieWall=!!document.querySelector("[id*=cookie i],[class*=cookie i],[class*=consent i]");
    return out; }, probe);
  await p.screenshot({path:`docs/demo/t2970-archive-${name}.png`});
  console.log(name, st, "load", loadMs+"ms", JSON.stringify(info));
  await ctx.close();
}
await b.close();
