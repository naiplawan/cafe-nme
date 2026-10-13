# Café and Restaurant POS Admin UX Research

## Summary

There is no single proven “best” back-office design in the reviewed evidence: product help centers document workflows and capabilities, not comparative usability results. Across Square, Toast, and Lightspeed, the repeated patterns are a useful operating snapshot, reports with date comparisons and drill-down, menu editing that reflects how items reach the POS, and clear team and device status.

For this single-shop café app, keep the experience focused on daily work. The admin already has a weekly sales dashboard and charts, member activity metrics, menu and modifier management, and paired-device last-seen information. The strongest next UX opportunities are a more direct menu editing workflow with preview and batch changes, clearer device health, report comparisons, and an easier-to-understand loyalty and staff setup path.

## Research question

Which back-office interaction patterns documented by current restaurant POS products are most applicable to this app’s `/admin` routes, and which gaps should be prioritized?

**Scope and date:** Public first-party help documentation from Square, Toast, and Lightspeed, plus W3C accessibility guidance, reviewed on 2026-10-13. Recommendations are scaled for a single café; features designed for multi-location chains are treated as optional.

**Useful answer:** Identify repeated product patterns, distinguish documented facts from UX interpretation, and map the recommendations to the existing admin routes.

## Findings

### 1. Lead with a small operating snapshot, then make the numbers open into detail

Toast’s Weekly Overview puts sales, labor, guest counts, and top items in one weekly view; it lets operators compare against prior periods and open a detailed report from a metric. Its Sales Summary also groups key figures and supports date ranges, comparison, filters, and export. Square similarly presents a sales summary in one place, with comparison charts, trends, metric definitions, filters, and export/share actions. [Toast: Weekly Overview](https://support.toasttab.com/en/article/How-to-Use-the-Toast-Reporting-Dashboard) · [Toast: Sales Reports Overview](https://support.toasttab.com/en/article/Sales-Reports-Overview) · [Square: Sales summaries and reports](https://squareup.com/help/us/en/article/5381-in-app-summaries-and-reports)

**Interpretation for this app:** The dashboard already has a 7-day sales view, hourly sales, top items, payment mix, and linked summary cards. Keep that as the starting point. The next improvement is contextual comparison (for example, this week vs. the previous week) and making charts or figures lead to the relevant filtered report. Keep the first row to a few owner questions—sales, order volume, and top items—then put less frequent detail lower on the page. The current reports page already offers date presets, charts, tables, and CSV export; a comparison range and short metric explanations would make it easier to interpret.

### 2. Treat the menu as one connected system, and let operators preview the POS result

Toast organizes menu data as menus → groups → items → modifier groups → modifiers. Its menu tools offer an at-a-glance bulk-edit view for settings such as visibility, tax, prep station, and sales category, and a POS layout preview before changes are published. Square allows bulk edits across item names, prices, modifiers, groups, categories, locations, and sales channels, and separates menu visibility from item visibility. Lightspeed links modifier groups to products or categories and exposes selection rules, default options, and prices as part of the modifier setup. [Toast: Get Started With Menus](https://support.toasttab.com/en/article/Get-Started-With-Menus?lang=en_US) · [Square: Create and update menus](https://squareup.com/help/us/en/article/6424-create-menus-with-square-for-restaurants) · [Lightspeed: Creating modifiers](https://resto-support.lightspeedhq.com/hc/en-us/articles/226404648-Creating-modifiers)

**Interpretation for this app:** Keep product, category, and modifier concepts connected rather than presenting them as unrelated settings pages. The app already has product editing, category grouping, and modifier assignment. The clearest next steps are menu search and filters (category, active/paused), batch status or price updates when lists grow, and a read-only POS preview before changes are saved. When a modifier group is edited, show its selection rule and which products use it so the consequence of a change is clear. A chain-style publish system is not required for one café, but the interface should still make the save outcome and where the change appears explicit.

### 3. Use device inventory to answer “is it working?” before “how do I change it?”

Toast’s Device Hub uses a single device table with online/offline status, last-seen time, connection state, alerts, and device identifiers. It provides status/type filters, search, and a per-device detail page for current issues and troubleshooting. [Toast: Device Hub Overview](https://support.toasttab.com/en/article/Device-Hub-Overview)

**Interpretation for this app:** The current device page shows whether a tablet is paired and when it was last seen. Keep those as separate states. Add an explicit last-seen label and a troubleshooting action near the affected device. Only label a device “online” or “offline” if the heartbeat data supports a clear threshold; a pairing token alone does not prove current connectivity. Search and filters can wait until shops commonly have more than a few devices.

### 4. Make team access explainable through roles, and preserve records when staff leave

Toast recommends permissions attached to job roles for the typical case and per-employee exceptions for special access. Square creates a team profile with a permission set, location scope, and personal passcode; its deactivate flow preserves the profile and allows reactivation rather than deleting the record. [Toast: Assign User Access Permissions](https://support.toasttab.com/en/article/Assigning-User-Access-Permissions) · [Square: Add and manage team members](https://squareup.com/help/us/en/article/8356-add-and-manage-team-members)

**Interpretation for this app:** The current owner/manager/barista roles are a good simple starting point for one store. Explain what each role can do where it is selected, keep PIN actions visibly tied to the staff member, and distinguish inactive staff from deleted staff. Add per-person permission overrides only if real shop workflows require them; importing the full complexity of enterprise permission sets would slow down a small café owner.

### 5. Treat loyalty as both setup and ongoing performance

Toast’s loyalty setup guides the operator through choosing an earning model, defining a reward, reviewing the program, publishing it to devices, and promoting enrollment. Square’s loyalty reporting provides date/location-filtered views of loyalty-vs-non-loyalty sales, visits, promotion impact, and top customers. [Toast: Get Started With Toast Loyalty](https://support.toasttab.com/en/article/Getting-Started-Toast-Loyalty) · [Square: View loyalty reporting](https://squareup.com/help/us/en/article/6467-view-your-square-loyalty-metrics)

**Interpretation for this app:** The admin already has member counts, growth, customer details, stamp balances, and reward activity. Tie these figures to next actions: find members who can redeem, inspect recent member activity, and see whether enrollment is connected through LINE. If the loyalty program needs setup, present it as a short checklist with a final review and status, rather than a long sequence of unrelated settings. The app’s LINE integration makes enrollment availability and connection health especially useful status signals.

### 6. Keep forms and feedback legible to keyboard and assistive-technology users

W3C guidance calls for visible labels or instructions for form controls, meaningful headings and labels, keyboard operation, and visible focus. WCAG 2.2 also requires that status messages be programmatically exposed to assistive technology without moving focus. [W3C WAI: Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/) · [WCAG 2.2](https://www.w3.org/TR/wcag/)

**Interpretation for this app:** Continue using visible field labels, use clear focus states for menus and forms, and announce save/error feedback with status or alert semantics. In dense tables, preserve meaningful column headers and keep row actions keyboard-accessible. These details improve the day-to-day experience for everyone, especially when owners manage the shop quickly on a tablet.

## Prioritized recommendations for `/admin`

| Priority | Recommendation | Existing route | Why it fits |
| --- | --- | --- | --- |
| 1 | Add product search and category/status filters; add batch edits for common changes as menus grow. Add a POS preview before saving or publishing. | `/admin/menu`, `/admin/menu/[productId]` | Menu changes are frequent and can affect what staff can sell. Competitor tools support bulk updates and POS previews. |
| 2 | Make each device’s pairing state and last-seen time scannable, then provide a focused recovery path. | `/admin/devices` | A paired device may still be disconnected; pairing and health answer different questions. |
| 3 | Add a prior-period comparison to the report/dashboard and make metric cards drill into filtered detail. | `/admin`, `/admin/reports` | Comparable periods and clickable details turn overview numbers into decisions. |
| 4 | Connect member metrics to actions such as redeemable rewards, recent activity, and LINE enrollment status. | `/admin/members`, `/admin/line` | Loyalty reporting is useful when it helps owners identify the next customer action. |
| 5 | Explain the consequences of each staff role and retain an inactive state for former staff. | `/admin/staff` | Role-based defaults are easier to manage than per-person permissions for a small shop; inactive records can be restored. |
| 6 | Keep labels, focus indicators, and save/error messages consistent across forms. | All admin forms | Supports faster keyboard use and prevents ambiguous settings changes. |

## Caveats and unknowns

- The reviewed product documentation explains current workflows and available features; it does not prove which product or layout is more usable in controlled testing.
- Square and Toast support multi-location, multiple order channels, and larger teams. Their full complexity should not be copied into a single-shop café admin without a matching need.
- “Best” depends on the café’s most common tasks, device size, staff roles, and menu size. Usage analytics or short owner interviews could reorder the priorities above.
- The device recommendations assume the app can reliably observe connectivity. If the backend only records a last-seen timestamp, show the timestamp and avoid promising real-time status.

## References

- Square Support Center, [Create and update menus](https://squareup.com/help/us/en/article/6424-create-menus-with-square-for-restaurants), accessed 2026-10-13.
- Square Support Center, [View sales summaries, sales trends and payment methods reports](https://squareup.com/help/us/en/article/5381-in-app-summaries-and-reports), accessed 2026-10-13.
- Square Support Center, [Add and manage team members](https://squareup.com/help/us/en/article/8356-add-and-manage-team-members), accessed 2026-10-13.
- Square Support Center, [View loyalty reporting](https://squareup.com/help/us/en/article/6467-view-your-square-loyalty-metrics), accessed 2026-10-13.
- Toast Support Center, [Get Started With Menus](https://support.toasttab.com/en/article/Get-Started-With-Menus?lang=en_US), accessed 2026-10-13.
- Toast Support Center, [Sales Reports Overview](https://support.toasttab.com/en/article/Sales-Reports-Overview), last updated 2026-10-06, accessed 2026-10-13.
- Toast Support Center, [Toast Reporting Dashboard: Weekly Overview](https://support.toasttab.com/en/article/How-to-Use-the-Toast-Reporting-Dashboard), last updated 2026-09-17, accessed 2026-10-13.
- Toast Support Center, [Device Hub Overview](https://support.toasttab.com/en/article/Device-Hub-Overview), last updated 2026-09-16, accessed 2026-10-13.
- Toast Support Center, [Assign User Access Permissions](https://support.toasttab.com/en/article/Assigning-User-Access-Permissions), last updated 2026-09-30, accessed 2026-10-13.
- Toast Support Center, [Get Started With Toast Loyalty](https://support.toasttab.com/en/article/Getting-Started-Toast-Loyalty), last updated 2026-10-01, accessed 2026-10-13.
- Lightspeed Restaurant Support, [Creating modifiers](https://resto-support.lightspeedhq.com/hc/en-us/articles/226404648-Creating-modifiers), accessed 2026-10-13.
- W3C Web Accessibility Initiative, [Labeling Controls](https://www.w3.org/WAI/tutorials/forms/labels/), accessed 2026-10-13.
- W3C, [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/wcag/), Recommendation dated 2024-12-12, accessed 2026-10-13.
