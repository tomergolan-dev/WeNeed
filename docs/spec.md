# We Need — Product Spec

Last updated: 2026-11-17. This version replaces the WhatsApp-bot spec (see "History" at the end).

## Vision

Everything a group of people "needs" in one place: things to buy, chores to get done, things to pack for a weekend away. We Need is a mobile-first web app where each **place** (an apartment, a home, an office, a restaurant) keeps shared lists, and an AI chat in every list turns a plain sentence ("need 2 cartons of milk and eggs") into list items.

The name is the product: everything in it is something "we need" to buy, to do, or to take.

We Need is also a portfolio project, so it includes a public demo.

## Users and places

- A **user** signs in with an email address (Google, or a code sent by email).
- A **place** is a shared space with members, for example "Parents' home", "My apartment", "Office", "Restaurant".
- A user can belong to several places and switches between them from a selector at the top of the screen.
- Every user has a **personal area, "שלי"**, created automatically. Signing in (Google or email code) opens the home screen on it; after that the app remembers the place last chosen (decided 2026-11-17). Its lists belong to no place ("ציוד לצפון"): private by default, and each can be shared with specific people by email. Lists others shared with the user appear there under "משותפות איתי".
- Any user can create a **shared place**, with a name and an icon (home, apartment, office, restaurant, store, vacation), and invite others to it (see "Invites").
- The place selector ("לאן להיכנס?") shows "שלי" first, then shared places with the user's role, then pending invites.
- The chosen place is remembered on the device. A new user starts in "שלי"; the first shared place is the default for users who have one.
- Roles in a shared place (decided 2026-11-17):
  - **Admin (מנהל, stored as `owner`):** sees every list, invites and removes members, changes roles, decides who sees each list, renames the place, deletes lists. The creator is an admin; a place keeps at least one.
  - **Member (חבר):** sees the lists open to them, edits them, and can create lists.
- Who sees a list ("מי רואה", admins only, from the list menu): **the whole place** (every member, also future ones) or **selected people** (admins always see it). The choice and the checks are one picture (decided 2026-11-18): under "the whole place" every member is checked, and unchecking someone moves to "selected people" with the rest still checked; choosing "selected people" starts from no one (admins always see); checking every member moves back to "the whole place". People invited to some lists only are checked one by one in both and stay on the list. The owner of a personal area is its admin.
- Someone invited **to some lists only** joins the place as a member who sees just those lists, plus lists they create. A list such a member creates starts as "selected people", with them on it.
- Only admins invite (decided 2026-11-17).
- **Leaving and deleting a place** (decided 2026-11-22), at the bottom of the place's settings:
  - "יציאה מהמקום", for anyone when someone else is in the place: the user leaves the place and its lists (the lists stay with the others) and lands on their personal area. The only admin is asked to make someone else an admin first, with a link to the members page.
  - "מחיקת המקום", admins only: deletes the place for everyone with its lists, history, notes, attachments (and their stored files) and pending invites. It asks for the place's name to be typed first. Members who had it open land on another place next time.
- First real places:
  - "הדירה של תומר ותמיר": Tomer, Tamir and Nurit (Tomer's mom).
  - "בית משפחת גולן": Nurit.

## Lists

- A new place starts with no lists. Members create the lists they need, of any kind and in any number, each with its own name.
  - For example, three shopping lists: "קניות שוק", "קניות מהקצבייה", "קניות סופר".
- There are three kinds of list:

| Kind | Purpose | Lifecycle |
| --- | --- | --- |
| 🛒 Shopping | Things to buy | Each shopping list has a current round; finishing it locks the round, moves it to that list's history, and starts a new empty round |
| ✅ Chores | Things to do, optionally by a date and time | Ongoing; done chores fade out |
| 📋 Checklist | A reusable list, e.g. "Weekend up north" | Permanent; items are checked and unchecked again and again |

- Tapping an item opens its edit sheet. Under the sheet's title, a small line says who added the item and when ("נוסף ע״י תומר · 22 בנוב׳, 13:06", or "נוסף על ידך" for one's own), in every kind of list (decided 2026-11-22, at Tomer's request).
- **Deleting several items** (every kind of list, decided 2026-11-22): a long press on an item (about half a second, with a short vibration where the phone supports it) switches the list to picking with that item picked; "בחירת פריטים" in the list's menu (⋯) does the same. Each row then gets a circle that turns red when picked (tapping the row picks it too), and a row under the progress (in a tasks list, under "לטיפול"; in a checklist, in place of its tools) has "בחר הכל", "ביטול" and "מחיקה (N)", which asks for a confirmation (it can't be undone, and takes the items' notes and attachments with them). The rest of the screen stays as it is. Nothing about it shows on the list until then, at Tomer's request, after versions with a visible "מחיקה" or "בחירה" pill felt crowded. A press that moves (a scroll) doesn't count, and rows don't select text or open the browser's menu on a long press.
- Lists can be renamed and deleted by members (deleting removes the list's history too, after a confirmation).
- The home screen shows the place's lists as cards (item counts, progress, and for chores the overdue and due-soon counts), and a "New list" button.
- **Choosing the kind:** a new list gets a name and a kind, shown as three cards, each with a line on what it is for. The kind is guessed from the name ("קניות סופר" → shopping, "מטלות הבית" → chores, "ציוד לטיול" → checklist; shopping when nothing hints) until the user picks one. The kind can be changed later from the list's menu. Decided 2026-11-17: an explicit kind keeps each list's actions clear (finish, due dates, check all), and the guess keeps it effortless. The AI chat may later guess less obvious names.

### Shopping lists

- Items have a name, quantity, unit and store section (category), and are grouped by section in store walking order.
- Who added an item is shown only in its edit sheet, not on the row (decided 2026-11-22: the initial beside each row was dropped, at Tomer's request).
- Check-off while shopping; checked items move to an "in the cart" section, and a progress bar shows how much is in the cart.
- Adding by hand: see "List screens". When the section is left on automatic, the item gets the section it had the last time it was bought in this place, otherwise the AI guesses it.
- **Finish shopping:** locks the current round and moves it to the list's history, and the list starts a new round. Unbought items stay on the list by default (the user can choose to drop them).
- **History:** per list, from the list's menu; each finished round shows what was bought and what wasn't, read-only.
- Item rules (from the bot era, kept for the AI chat):
  - Product names are kept exactly as written: no spelling fixes, no expanding slang ("גבנצ" stays "גבנצ").
  - A number with x or × ("x18", "18x") is a count of units.
  - A count without a unit is shown as "18 יח׳".
  - An item that is already on the list (open, same name ignoring spelling marks and spacing) is not added twice:
    - In the AI chat, the chat asks whether to update its quantity.
    - When adding by hand, the quantities are added up at once ("תפוח עץ" 5 + 3 → 8), with a short note under the field. With no quantity, nothing changes ("already on the list"). With a different unit, it is added as its own row.

### Chores

- Shown in the app as **"משימות"** (tasks), the more general word; "מטלות הבית" is just an example (decided 2026-11-17).
- A place can have several chores lists.
- A chore has a title, an optional **due date** and **due time** (Israel time), and an optional assignee. In the edit sheet, date and time sit side by side, each inside its own half (iOS draws these fields wider than their column unless told not to).
- Status signs, like traffic signs:
  - **Due soon** (within 24 hours): a yellow mark and a pill ("בעוד 3 שעות", "היום").
  - **Overdue:** a red mark and a pill ("באיחור של יום").
  - A chore with a date and no time is due at the end of that day.
- Open chores have two sorts, switched above the list:
  - **By date** (the default): overdue, due soon, later by date, then those without a date in the order they were added.
  - **By order added.**
- Filters: all, "עבורי" (assigned to me; only when the list has more than one person), due soon, overdue. They sit in one quiet row styled like the sort switch, with a count beside due soon and overdue only when there is something to count (decided 2026-11-22, at Tomer's request; a "no date" filter was dropped to keep the row short).
- Check-off marks a chore as done; done chores stay visible for a week under "done recently".
- **Task emails** (decided 2026-11-22, at Tomer's request), only to the person a task is assigned to:
  - **Assigned:** when someone assigns a task to someone else (by hand or through the AI chat), the assignee gets an email right away. Assigning a task to yourself sends nothing.
  - **Send a reminder:** the task's edit sheet has "שליחת תזכורת במייל ל…" for a task assigned to someone else. One per task every 10 minutes. Not in the demo.
  - **Automatic reminders:** an hour before a task with a time; at 8:00 and at 17:00 on the day of a task with a date only (not an hour before midnight, which is too late). Each goes out once per due time, so moving the date sends them again. None when the assignee was emailed about the task in the last hour.
  - **A list only one person sees** (decided 2026-11-23, at Tomer's request): its tasks are theirs, so unassigned tasks get the automatic reminders too, and the edit sheet hides "אחראי/ת" (there is no one else to choose).
  - Nothing is sent for done tasks, to people who no longer see the list, or to people who turned "מיילים על משימות" off in the account menu (on by default).
  - The email is in the language the assignee last opened the app in, with the task, its due time, the list, the task's note (up to 600 characters), and a button to the list. It looks like the sign-in code email (same colors, font and layout).
  - Limits: at most 12 task emails a day per person, and no task emails once 90 emails (sign-in codes, invites and task emails together) went out in a day, under Resend's free 100.
  - Schedule: a GitHub Actions workflow (`.github/workflows/task-reminders.yml`) calls `/api/cron/reminders` every 10 minutes with `CRON_SECRET`; Vercel's Hobby plan runs its own cron jobs only once a day. GitHub may run it a few minutes late, so the reminder windows are wide.
- **Tasks in the calendar** (decided 2026-11-22): "הוספת המשימות ליומן שלי" in the account menu gives each user a private calendar link (`/api/calendar/<token>.ics`) to add once to Google Calendar or the iPhone calendar; after that the calendar updates on its own (Google every few hours, the iPhone as set on the phone).
  - It holds open tasks with a date, assigned to the user or to no one, in lists the user can see; tasks assigned to others, done tasks and tasks without a date stay out. Tasks overdue by more than 60 days are left out too.
  - A task with a time is a half-hour event at that time; a task with only a date is an all-day event. The event's description has the task's note (up to 1000 characters), the list's name and a link back to it. Attachments stay in the app.
  - The link is the only key (calendar apps fetch it without signing in), so "קישור חדש" replaces it and the old one stops working.
- **Names** (decided 2026-11-23, at Tomer's request), in the account menu:
  - A pencil beside the user's name at the top edits it ("השם שלי"). Everyone sees it. A new user gets the Google profile's name (or the address); this changes it.
  - "החברים שלי", a row under the calendar, opens a screen of its own in the menu (with a way back, since the list can be long): like contact names in a phone, the user can give anyone they share a place or a list with their own name for them ("אמא" for נורית, "תמיר" for תמיר ליטבק). Only that user sees it, everywhere: who added an item, the assignee picker, members, who sees a list, history, lists shared with them, task emails sent to them, and the AI chat ("תשייך לאמא"). Empty goes back to the name the person chose.
  - Not in the demo (it has no account).

### Checklists

- In Hebrew this kind is called "רשימות" (decided 2026-11-19: Tomer prefers a Hebrew word to "צ׳קליסט"); in English it stays "Checklist". Hebrew copy that names all three kinds says "לקניות, למשימות ולכל דבר אחר" rather than "צ׳קליסטים".

- A list to check off, without dates: not necessarily fixed, it changes as needed and can be kept for next time. For example "Weekend up north" or "Gym bag".
- Items can be added, edited and removed at any time; the list itself stays.
- **Check all** and **Uncheck all**, mainly to reset the list before the next use.
- The progress line has a row of its own across the list, like a shopping list ("12 מתוך 15 מסומנים"); under it, the tools: "סמן הכל", "איפוס" and "סדר" (decided 2026-11-22, at Tomer's request).
- Unchecked items are shown first, with a progress bar; each group keeps the list's order.
- **Reorder:** "Change order" switches the list to a mode where items are dragged by a handle (touch, mouse or keyboard). The order is saved for everyone. New items go last.

### List screens

- The title and the manual add field stay at the top, and the AI chat at the bottom; only the list scrolls between them.
- **Adding by hand** (top): one field with an "Add" button. Once a name is typed, a row of small controls opens under it:
  - Shopping: quantity (with − and +), unit, and section (automatic by default).
  - Chores: "today", "tomorrow", another date, a time (once there is a date), and an assignee.
  - Checklists: the name only.
- Decided 2026-11-17, at Tomer's request: adding by hand moved to the top so quantities and details are set while adding, not by editing afterwards, and the bottom is kept for the AI chat.

## Attachments

- Any item can have a note, links, and photos or documents. On the row, a small paperclip when it has attachments, without a count (or a note mark), right after the item's name, opens the item's details; items without any reach them from their edit sheet ("פרטים וצירופים").
- The details sheet: the note (saved when leaving the field), links (opened in a new tab), and thumbnails of photos and documents, with buttons to add a link, take a photo, or pick a file.
- Files: photos (JPEG, PNG, WebP, GIF, HEIC), PDF, Word, Excel and plain text, up to 15MB each and 20 attachments per item.
- Storage: a private Vercel Blob store (`weneed-attachments`, Frankfurt). The browser uploads straight to it with a one-time token that only someone who can edit the item gets, under `items/<itemId>/`. Files are served only through `/api/attachments/[id]`, to people who see the list; they never get a public address. Deleting an attachment, an item or a list deletes its files.
- When a shopping round is finished, unbought items carried over to the new round take their note and attachments with them (decided 2026-11-17, at Tomer's request). Bought items keep theirs in the history, read-only.

## AI chat

- The chat is a bar at the bottom of every list, with an AI mark and, for each kind of list, a question and a short example ("מה חסר? למשל: 2 חלב, ביצים ולחם", "מה צריך לעשות? למשל: כביסה מחר", "מה להוסיף? למשל: פנס, כובע ומגבת"). The example is in smaller type than what is typed (14px), and each one fits on one line on a 360px-wide phone (decided 2026-11-19, after a longer one was cut off; Tomer wanted the questions kept, with "מה חסר?" for shopping). The reply shows above the bar, so the list stays in view. A plain reply is one short line ("הוספתי: ביצים, עגבניות" with "undo") that disappears after 3 seconds (errors after 5). A question about an item already on the list ("להוסיף עוד 2?") opens a card that stays until answered. Decided 2026-11-17, at Tomer's request.
- The message box takes several lines and grows up to about four, then scrolls. On a phone Enter adds a line and the arrow sends; on a computer Enter sends and Shift+Enter adds a line (decided 2026-11-17). On a phone a list screen is a fixed frame the size of the screen (decided 2026-11-19): the top bar (name and quick add) never moves, the list scrolls beneath it, and the box sits at the bottom. While typing to the box it sits right above the keyboard, with the list still scrolling between; while typing in quick add it stays at the bottom, behind the keyboard. On a computer the page scrolls as before.
- Each message is read once; there is no chat history yet.
- Limits against abuse: at most 100 messages per user and 2,000 in total in 24 hours.

- Every list has a chat where the user writes what they need, and the AI updates the list.
- What the AI adds stays in the language it was written in: an English message gives English names, units and tasks, a Hebrew one Hebrew; it never translates (decided 2026-11-19, after the English demo got Hebrew names for an English message).
- Shopping: extracts name, quantity, unit and section per item. For an item already on the list it asks whether to update the quantity (for example "כן, 24 יח׳" or "להשאיר").
  - "Already on the list" means the same product: singular/plural, spelling, another language, or a plain name for a listed item with a brand or percentage ("חלב" for "חלב 3%"). A related product is not the same ("גבינה לבנה" vs "גבנצ 15%"). Besides the AI's judgement, the two names must share a word (allowing singular/plural), unless they are in different languages (decided 2026-11-17).
  - Asking again with no amount adds one more of what is on the list ("2 חבילות" -> "כן, 3 חבילות"); a bare number uses the unit already on the list.
- Chores: extracts the title and, when given, the date and time ("tomorrow at 5", "by Friday").
- Checklists: adds the items written, and skips those already on the list.
- Manual adding and editing always remain available, for quick or precise changes.
- Model: Claude (`claude-haiku-5-5`), with structured outputs. The parsing rules come from the bot (`src/lib/ai/list-assistant.ts`).
- **Editing by chat** (decided 2026-11-22): the chat also changes items already on the list, alone or together with adding ("תוסיף עגבניות ותוריד את הבננות").
  - Shopping: mark bought or back ("קניתי לחם"), set the amount ("תעשה 3 ביצים"), rename, remove. Asking for more of an item ("עוד 2 חלב") is still the "add more?" question.
  - Checklists: check or uncheck ("תסמן את הכובע והמגבות", "תאפס הכל"), rename, remove.
  - Tasks: done or open again, a new date or time ("תעביר את הזבל למחר ב-8", "הזבל ב-22"), no date, assign or unassign ("תשייך את המזגן לדני"), rename, remove. An assignment sends the task email, as from the edit sheet.
  - The reply shows what changed ("עדכנתי: ביצים (5 יח׳)"), and "ביטול" undoes the changes and the additions of that message together.
  - Removing never happens straight away: the reply asks "למחוק מהרשימה את …?" with "כן, למחוק" and "להשאיר", since a deletion can't be undone and takes the item's notes and attachments with it.
  - An item the message names that isn't on the list is reported ("לא מצאתי ברשימה: …").

## Sign-in

- Two ways in, both by email address. No password.
  - **Sign in with Google:** one tap; Google confirms the address.
  - **Code by email:** a 6-digit code sent through Resend from `noreply@tomergolan.dev`. It is valid for 10 minutes, allows 5 attempts and works once.
- **Open sign-up:** anyone can sign in; a user is created on first sign-in, named after the Google profile (or the address). Users see only the places they belong to.
- Limits against abuse: at most 3 codes per address every 15 minutes, and at most 80 codes a day in total (Resend's free plan sends 100 emails a day). Google sign-in has no limit.
- Users from the bot era (Tomer, Nurit) are linked to their address with `npm run user:link-email -- <email> <phone>`, keeping their places and history.
- The session lasts a long time (a year), so users rarely need to sign in again.
- Decided 2026-11-17, instead of SMS codes to an allowlist: email is free, so there is no cost to protect, and Google makes it one tap.

## Invites

- An admin invites by email address, in two ways:
  - From "חברים במקום" (settings): to the whole place, or to selected lists.
  - From a list's "מי רואה": to this list only. In a personal area this is how a list is shared.
- Someone already in the place is added to the lists right away, without an invite.
- One pending invite per address and place; inviting again widens it. Up to 30 invite emails per admin per day.
- The email (Resend) says who invited and to what, with a "view the invite" button. The link opens `/invites/[id]`, which works only for the invited address after sign-in.
- The invite screen shows the list or place, what the person will see, who is already on the list, and Accept / Decline. Accepting opens the list.
- Pending invites also appear as a banner on the home screen and in the place selector.
- Admins see pending invites on the members screen and can cancel them. Accepted, declined or canceled invites can't be used again.
- Later, maybe: invites through the WhatsApp bot (needs a Meta-approved template).

## Demo

- At `/demo` (and `/en/demo`), open to everyone with no sign-up; a "Demo ↗" button (in English in both languages) sits in the sign-in screen's header, next to the language switch.
- Shows a sample place ("הבית לדוגמה" / "Sample home") with a shopping list, a tasks list (one overdue, one due soon, one with a note and a link) and a checklist, in the page's language.
- Visitors can do everything they can in the app on those lists: add, check, edit, delete, reorder, finish a shopping trip, create, rename and delete lists, and add notes, links and files (decided 2026-11-17).
  - Everything stays in the visitor's browser (localStorage, one copy per language). Files stay only until the page reloads. "Start over" brings back the sample place.
  - No history of finished trips, no members, invites or settings.
- The AI chat works in the demo (decided 2026-11-17), with limits: 10 messages per visitor and 200 for all visitors per day. The server only reads the message and returns what it understood; the browser adds the items, with the same rules as the app (`src/lib/assistant-plan.ts`).
  - For the limits, the database keeps one row per message with a keyed hash of the visitor's IP address (`demo_ai_requests`), never the address or the message.
- Nothing else a demo visitor does reaches the database, and demo visitors never see real places or real data.
- How it is built: the list screens take their actions from a swappable "backend" (`src/components/lists/backend.tsx`): the server actions in the app, a browser store in the demo (`src/components/demo/`).

## Design

- Mobile-first, installable to the home screen (PWA), so it opens like a regular app.
  - Like an app, the screen does not zoom or move sideways (decided 2026-11-18): zoom is off in the viewport, and nothing is wider than the screen. Rows that scroll sideways scroll inside themselves. On phones the top bar of each screen stays in place with a solid background (so iOS tints the status bar with it instead of blurring what is under it), and the page does not bounce past its top or bottom.
- Visual style influenced by CheckPlease (Tomer's earlier app): similar icon style and the feel of a polished, modern, high-end app. Not a copy, and with a different color palette.
- The design is drafted and approved as a mockup before it is built.
- Lighter and more minimal (decided 2026-11-18, at Tomer's request): a list's progress is one thin line with a short count ("3 מתוך 7 מסומנים") instead of a card; a checklist's "סמן הכל", "איפוס" and "סדר" are small labeled pills under it (dimmed when there is nothing to do; "סדר" turns green while on, and tapping it again ends reordering, with no separate Done button); header buttons are round; checkboxes and the add field are slimmer; a list's subtitle names only where it lives, not its kind; "סיום קנייה" has a cart icon.
- Wide screens (1024px and up), decided 2026-11-17 (option A of three mockups): a sidebar beside the screen with the logo, the account menu button, and every place the user belongs to with its lists (the personal area first, with lists shared with the user). Each list shows what is left, or tasks overdue or due soon. Clicking a place opens its home screen; a small "+" beside every place opens "New list" for that place (decided 2026-11-18, replacing a "New list" link under the current place only). The screen beside it is wider, the home screen's lists are in two columns, a shopping list's sections flow into two columns, and "back to home" is left to the sidebar. Phones keep the single-column app unchanged. The demo has the same sidebar. The sign-in screen on a wide screen is split: the form on one half, and on the other a brand-green panel with the slogan, a line on what WeNeed is, and the three kinds of lists.
- Hebrew (right to left) and English (left to right), decided 2026-11-17:
  - Hebrew lives at the plain addresses, English under `/en` (for example `/en/lists/…`).
  - Signed in (and in the demo), the language is chosen in the account menu: the home screen's top row is fixed in every place, with the logo and one menu button (decided 2026-11-18, styled after Check Please). The menu is a bottom sheet with the user's name and email, a "שפה" row with עברית | English segments, and a plain "התנתקות" at the bottom (in the demo, "כניסה" instead). A place's settings are not in the top row: on a shared place's home screen a gear sits beside "מה צריך היום?" and opens them; the personal area has none. The line under that title (how many lists, how many need attention) was dropped.
  - The sign-in and privacy screens keep a globe switch (like the Mac keyboard key) that moves to the same page in the other language.
  - The choice is remembered in a cookie for a year (not only until the browser or app closes, decided 2026-11-18); a first visit follows the browser's language.
  - Sign-in and invite emails go out in the language of the page they were sent from.
  - What people type (list and item names) is shown as written, in any language.
  - The paused WhatsApp bot stays Hebrew only.
- Branding (decided 2026-11-17):
  - Name: **WeNeed**, in English only, everywhere (browser tab, home screen, emails).
  - Slogan: "כל מה שצריך. מסודר במקום אחד." (English: "Everything you need. Organized in one place."; changed 2026-11-19 from "כל מה שצריך. ביחד."). It appears on the sign-in screen, in the site description and on the share cover.
  - Icon: a green tile with three list rows, the first two checked (`src/app/icon.svg`; PNGs for phones in `public/` and `src/app/apple-icon.png`).
  - Share cover (`public/og.png`, `public/og-en.png`, 1200×630), redesigned 2026-11-19: minimal, in brand green with soft circles; centered, the icon and name, the slogan as the headline, three small icons for the kinds of lists, and the address at the bottom. The image URL carries `?v=` so apps that cached an old cover fetch the new one.
  - Each kind of list has its own icon: a cart for shopping, a calendar with a check for tasks (they have dates), a checked list for checklists.

## Domain and hosting

- Production address: `weneed.tomergolan.dev`.
- `tomergolan.dev` is registered at Namecheap (already used for CheckPlease). The subdomain is attached to the Vercel project and points to Vercel with a CNAME record at Namecheap.
- Sign-in emails are sent from `tomergolan.dev`, already verified in Resend for CheckPlease.
- Hosting: Vercel. Database: Neon Postgres.

## Architecture and stack

- **Stack:** Next.js (App Router), TypeScript, Tailwind, shadcn/ui, next-intl, Drizzle, Neon, Vercel. Claude API for the AI chat.
- **Data model:**
  - `users` with a unique email address (the phone number stays only for the paused bot). *(Stage B)*
  - `places` (name, icon), and a many-to-many `place_members` table between users and places, with a role (`owner` / `member`). *(Stage B)* A place with `personal_owner_id` is that user's personal area; `place_members.all_lists` is false for someone invited to some lists only. *(Stage E)*
  - `sign_in_codes`: hashed one-time email codes with expiry and attempt count. *(Stage B)*
  - `invites`: place, invited email, invited by, list ids (null for the whole place), status (`pending` / `accepted` / `declined` / `canceled`). *(Stage E)*
  - `lists.visibility` (`place` / `selected`) and `list_members` (list, user): who sees a list beyond the place's admins. *(Stage E)*
  - `lists`: place, kind (`shopping` / `tasks` / `checklist`), name. *(Stage C)*
  - `rounds`: each round of a list (status `active` / `completed`, finished at and by). At most one active round per list; items belong to a round. A chores list keeps one ongoing round. *(Stage C)*
  - `items` have an optional due date and time, used by chores, and a position (their order in the round). *(Stage C)*
  - `ai_requests`: one row per AI chat message, for the daily limits. *(Stage D)*
  - `task_emails`: one row per task email (item, recipient, kind, due key, sent by), for sending each automatic reminder once and for the limits; `users.locale` and `users.task_emails` for the email's language and the on/off switch. *(Migration 0013)*
  - `contact_names`: what a user calls someone else (owner, person, name). *(Migration 0015)*
  - `demo_ai_requests`: one row per demo AI message (a keyed hash of the visitor's IP), for the demo's limits. *(Stage H)*
  - `items.note`, and `attachments`: item, kind (`link` / `file`), the link's address or the file's Blob pathname, name, content type and size, added by. *(Stage F)*
- **Secrets:** only in environment variables; `.env.example` stays up to date.
- **Databases:** production uses the main Neon branch; local development uses a separate Neon branch named `dev`. Migrations are tested on `dev` first and run on production only when a stage is released.

## Development stages

- [x] **Stage A, design:** mockup of the main screens (place selector, the three list kinds, AI chat, invites), approved on 2026-11-16.
  - Mockup: https://claude.ai/artifact/GmZihD6hb1TcGkQeeksQxj
- [ ] **Stage B, places and sign-in:** users, several places per user, place selector, sign-in with Google or an email code, open to everyone.
  - Built and tested on the `dev` database. The existing household moved to a place, its members to users (as owners).
  - Released to production on 2026-11-17: migrations run, Tomer's and Nurit's addresses linked to their bot-era users.
- [ ] **Stage C, lists:** named lists of all three kinds, several per place, in the new design.
  - Shopping: finish shopping and per-list history. Chores: due date and time, due-soon and overdue signs. Checklists: check all / uncheck all.
  - Built and tested on the `dev` database. The existing lists became "קניות" (with its finished rounds as history) and "מטלות".
  - Chores and checklists were moved into this stage on 2026-11-17, before the AI chat, at Tomer's request. Reordering checklists and the two chores sorts were added the same day, also at his request.
  - Released to production on 2026-11-17: the database was backed up, then migrations 0004–0008 were run.
- [ ] **Stage D, AI chat:** chat in every list, reusing the bot's parsing.
  - Built and tested on the `dev` database, with adding by hand moved to the top of the list.
  - Released to production on 2026-11-17: the database was backed up, then migration 0009 was run.
- [ ] **Stage E, personal area, invites and permissions:** "שלי", invite by email to a place or to lists, accept or decline in the app, members and roles, who sees each list.
  - Mockup approved on 2026-11-17 (rows "שלי, הרשאות וצירופים" in the mockup).
  - Built and tested on the `dev` database (migration 0010).
  - Released to production on 2026-11-17: the database was backed up, then migration 0010 was run.
- [x] **Stage F, attachments:** a paperclip on an item opens its details: a note, links, and photos or files (private Vercel Blob storage).
  - Built and tested on the `dev` database (migration 0011). The Blob store was created on 2026-11-17 and connected to all environments.
  - Released to production on 2026-11-17: the database was backed up, then migration 0011 was run.
- [x] **Stage G, branding:** icon, name, slogan, share cover and home-screen install (see "Design").
  - Built on 2026-11-17, together with the wording change from "מטלות" to "משימות".
- [ ] **Stage H, demo and launch:** public demo, `weneed.tomergolan.dev`, real places for Tomer, Tamir and Nurit.
  - English alongside Hebrew: built 2026-11-17.
  - Public demo at `/demo`: built 2026-11-17 (migration 0012).
  - Privacy policy page at `/privacy` (done 2026-11-17, contact tomergolan01@gmail.com).
  - Google sign-in is open to everyone: the Google app's branding is filled in and it is published ("In production", external users), done 2026-11-17. It asks only for basic scopes (openid, email, profile), so it needs no Google verification and the 100-user cap does not apply. No logo was uploaded, since a logo would require brand verification.

## Open questions

- [x] Demo: editable in the browser, with the AI chat limited (decided 2026-11-17, see "Demo").
- [x] Language: Hebrew and English (decided 2026-11-17, see "Design").
- [x] "Due soon": 24 hours before the due time (decided 2026-11-17; easy to change in `src/lib/due.ts`).
- [ ] Chores: is there an assignee per chore?
- [x] Permissions (Stage E): decided 2026-11-17, see "Users and places".
- [x] Can regular members invite people to lists they see? No, only admins invite (decided 2026-11-17).
- [x] Leaving a place, and deleting a place: built 2026-11-22, see "Users and places".

## Future

- Two-way calendar sync (changing a task from the calendar). Needs Google's calendar permission, which requires app verification.
- Sign in with Facebook. Possible through the existing Meta app, but it needs a published privacy policy and a data deletion URL, and some Facebook accounts have no email address, so it waits for the launch stage.
- The WhatsApp bot as an extra way to add items.

## History

Until 2026-11-16 the product was a WhatsApp bot backed by a small web app. That version was built and tested on a Meta test number (stages 0–5 in the git history): webhook with signature checks, Claude parsing, duplicate questions, list carry-over, chores and reply buttons. It was paused because a chat bot made switching between several places and lists awkward. Its code stays in the repository, disconnected from the new product, and its parsing rules carry over to the AI chat.
