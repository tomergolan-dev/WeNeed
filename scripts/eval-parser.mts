// Runs sample messages through the Claude parser and checks the result.
// Calls the real API (a fraction of a cent per run).
// Usage: npm run eval:parser
// Expected items: [name substring, quantity, category or "a|b" for either,
// optional existing list item it should match (null = must not match)].
// The current list is ["לחם"] unless a case gives its own.
import { parseMessage } from "@/lib/bot/parse-message";
type Exp = {
  intent: string;
  list?: string[];
  items?: [string, number | null, string, (string | null)?][];
  chores?: [string, string | null][]; // [title substring, assignee]
  ambiguous?: boolean;
};
const people = { sender: "תומר", members: ["תומר", "נורית"] };
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
  ["חבילת ביצים 18x", { intent: "add_items", items: [["ביצים", 18, "dairy"]] }],
  ["במבה", { intent: "add_items", items: [["במבה", null, "snacks"]] }],
  ["קולה x6", { intent: "add_items", items: [["קולה", 6, "drinks"]] }],
  ["תוסיף:\n14 מעדני שוקולד\n10 יוגורטים מולר פרוטאין עם פקאן\n12 יוגורטים מולר פרוטאין עם בוטנים\nחבילת ביצים x18\n2 חבילות גבנצ 15%", { intent: "add_items", items: [["מעדני שוקולד", 14, "dairy|snacks"], ["מולר פרוטאין עם פקאן", 10, "dairy"], ["מולר פרוטאין עם בוטנים", 12, "dairy"], ["ביצים", 18, "dairy"], ["גבנצ 15%", 2, "dairy"]] }],
  ["ביצים 12", { intent: "add_items", list: ["ביצים", "סומאק"], items: [["ביצים", 12, "dairy", "ביצים"]] }],
  ["2 שישיות מים", { intent: "add_items", items: [["מים", 2, "drinks"]] }],
  ["צריך חלב", { intent: "add_items", list: ["חלב", "לחם"], items: [["חלב", null, "dairy", "חלב"]] }],
  ["עוד 2 עגבניות ומלפפון", { intent: "add_items", list: ["עגבנייה", "גבינה"], items: [["עגבני", 2, "produce", "עגבנייה"], ["מלפפון", null, "produce", null]] }],
  ["צריך לחמניות", { intent: "add_items", list: ["לחם"], items: [["לחמני", null, "bakery", null]] }],
  ["need milk", { intent: "add_items", list: ["חלב"], items: [["milk", null, "dairy", "חלב"]] }],
  ["חלב סויה", { intent: "add_items", list: ["חלב"], items: [["חלב סויה", null, "dairy", null]] }],
  ["תומר צריך לתקן את הברז באמבטיה", { intent: "add_items", chores: [["ברז", "תומר"]] }],
  ["נורית צריכה לקבוע תור לרופא שיניים", { intent: "add_items", chores: [["תור", "נורית"]] }],
  ["אני צריך להוציא את הזבל", { intent: "add_items", chores: [["זבל", "תומר"]] }],
  ["צריך להחליף נורה במטבח", { intent: "add_items", chores: [["נורה", null]] }],
  ["צריך חלב ונורית צריכה להתקשר לאינסטלטור", { intent: "add_items", items: [["חלב", null, "dairy"]], chores: [["אינסטלטור", "נורית"]] }],
  ["מה המטלות?", { intent: "show_chores" }],
  ["אני צריך להכין למחר צוהריים - חזה עוף בנינג'ה ולתוספת פתיתים", { intent: "add_items", ambiguous: true, chores: [["פתיתים", "תומר"]], items: [["חזה עוף", null, "meat_fish"], ["פתיתים", null, "pantry"]] }],
  ["להכין חזה עוף ופתיתים לצוהריים", { intent: "add_items", ambiguous: true, chores: [["חזה עוף", null]], items: [["חזה עוף", null, "meat_fish"], ["פתיתים", null, "pantry"]] }],
  ["זיתים מגולענים שימורים", { intent: "add_items", ambiguous: false, items: [["זיתים מגולענים", null, "canned"]] }],
  ["מעדני שוקולד 12 יחידות", { intent: "add_items", ambiguous: false, items: [["מעדני שוקולד", 12, "dairy|snacks"]] }],
  ["לתקן את הברז", { intent: "add_items", ambiguous: false, chores: [["ברז", null]] }],
  ["להכין שקשוקה", { intent: "add_items", ambiguous: false, chores: [["שקשוקה", null]] }],
  ["לבשל אורז עם שעועית", { intent: "add_items", ambiguous: true, chores: [["אורז", null]], items: [["אורז", null, "pantry"], ["שעועית", null, "pantry|canned|produce"]] }],
  ["לעבור מחר בסופר יודה לקנות בצל לבן", { intent: "add_items", items: [["בצל לבן", null, "produce"]] }],
  ["מה אני צריך לעשות?", { intent: "show_chores" }],
  ["צריך נורות", { intent: "add_items", items: [["נור", null, "home"]] }],
  ["פסטה ורוטב עגבניות", { intent: "add_items", items: [["פסטה", null, "pantry"], ["רוטב עגבניות", null, "spices|canned"]] }],
];
let pass = 0;
for (const [msg, exp] of cases) {
  const r = await parseMessage(msg, exp.list ?? ["לחם"], people);
  const errs: string[] = [];
  if (!r) errs.push("null");
  else {
    if (r.intent !== exp.intent) errs.push(`intent ${r.intent}`);
    if (exp.ambiguous !== undefined && r.ambiguous !== exp.ambiguous) errs.push(`ambiguous ${r.ambiguous}`);
    const want = exp.items ?? [];
    if (r.items.length !== want.length) errs.push(`count ${r.items.length}`);
    const wantChores = exp.chores ?? [];
    if (r.chores.length !== wantChores.length) errs.push(`chores ${r.chores.length}`);
    wantChores.forEach(([title, who], i) => {
      const c = r.chores[i]; if (!c) return;
      if (!c.title.includes(title)) errs.push(`title ${c.title}`);
      if (c.assignee !== who) errs.push(`assignee ${c.title}=${c.assignee}`);
    });
    want.forEach(([n, q, c, ex], i) => {
      const it = r.items[i]; if (!it) return;
      if (!it.name.includes(n)) errs.push(`name ${it.name}`);
      if (it.quantity !== q) errs.push(`qty ${it.name}=${it.quantity}`);
      if (!c.split("|").includes(it.category)) errs.push(`cat ${it.name}=${it.category}`);
      if (ex !== undefined && it.existing !== ex) errs.push(`existing ${it.name}=${it.existing}`);
    });
  }
  if (!errs.length) pass++;
  console.log(`${errs.length ? "FAIL" : "ok  "} | ${msg} -> ${[...(r?.items.map(i => `${i.name}${i.quantity ? "×" + i.quantity : ""}${i.unit ? " " + i.unit : ""}`) ?? []), ...(r?.chores.map(c => `[${c.title} / ${c.assignee}]`) ?? [])].join(", ") || r?.intent}${errs.length ? "\n     " + errs.join("; ") : ""}`);
}
console.log(`${pass}/${cases.length} passed`);
if (pass < cases.length) process.exitCode = 1;
