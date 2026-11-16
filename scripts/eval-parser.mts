// Runs sample messages through the Claude parser and checks the result.
// Calls the real API (a fraction of a cent per run).
// Usage: npm run eval:parser
// Expected items: [name substring, quantity, category or "a|b" for either].
import { parseMessage } from "@/lib/bot/parse-message";
type Exp = { intent: string; items?: [string, number | null, string][] };
const cases: [string, Exp][] = [
  ["צריך 2 קרטוני חלב וביצים", { intent: "add_items", items: [["חלב", 2, "dairy"], ["ביצ", null, "dairy"]] }],
  ["נגמר השמן זית", { intent: "add_items", items: [["שמן זית", null, "pantry"]] }],
  ["עגבניות, מלפפונים, 3 בצלים ונייר טואלט", { intent: "add_items", items: [["עגבני", null, "produce"], ["מלפפ", null, "produce"], ["בצל", 3, "produce"], ["נייר טואלט", null, "personal_care"]] }],
  ["מה ברשימה?", { intent: "show_list" }],
  ["שלח לי קישור", { intent: "login_link" }],
  ["תודה!", { intent: "other" }],
  ["need bread and 6 yogurts", { intent: "add_items", items: [["bread", null, "bakery"], ["yogurt", 6, "dairy"]] }],
  ["תוסיף חצי קילו גבינה צהובה ושני בקבוקי קולה", { intent: "add_items", items: [["גבינה צהובה", 0.5, "dairy"], ["קולה", 2, "drinks"]] }],
  ["אין לנו יותר אבקת כביסה", { intent: "add_items", items: [["אבקת כביסה", null, "cleaning"]] }],
  ["מה צריך לקנות היום?", { intent: "show_list" }],
  ["חיתולים מידה 4", { intent: "add_items", items: [["חיתולים", null, "baby"]] }],
  ["בוקר טוב מה נשמע", { intent: "other" }],
  ["חבילת ביצים 18x", { intent: "add_items", items: [["ביצים", null, "dairy"]] }],
  ["במבה", { intent: "add_items", items: [["במבה", null, "snacks"]] }],
  ["קולה x6", { intent: "add_items", items: [["קולה", null, "drinks"]] }],
  ["2 שישיות מים", { intent: "add_items", items: [["מים", 2, "drinks"]] }],
  ["פסטה ורוטב עגבניות", { intent: "add_items", items: [["פסטה", null, "pantry"], ["רוטב עגבניות", null, "spices|canned"]] }],
];
let pass = 0;
for (const [msg, exp] of cases) {
  const r = await parseMessage(msg, ["לחם"]);
  const errs: string[] = [];
  if (!r) errs.push("null");
  else {
    if (r.intent !== exp.intent) errs.push(`intent ${r.intent}`);
    const want = exp.items ?? [];
    if (r.items.length !== want.length) errs.push(`count ${r.items.length}`);
    want.forEach(([n, q, c], i) => {
      const it = r.items[i]; if (!it) return;
      if (!it.name.includes(n)) errs.push(`name ${it.name}`);
      if (it.quantity !== q) errs.push(`qty ${it.name}=${it.quantity}`);
      if (!c.split("|").includes(it.category)) errs.push(`cat ${it.name}=${it.category}`);
    });
  }
  if (!errs.length) pass++;
  console.log(`${errs.length ? "FAIL" : "ok  "} | ${msg} -> ${r?.items.map(i => `${i.name}${i.quantity ? "×" + i.quantity : ""}${i.unit ? " " + i.unit : ""}`).join(", ") || r?.intent}${errs.length ? "\n     " + errs.join("; ") : ""}`);
}
console.log(`${pass}/${cases.length} passed`);
if (pass < cases.length) process.exitCode = 1;
