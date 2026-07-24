# Maritime Fee & Payroll Calculator

Hey there! This is a specialised calculator tool we built specifically for maritime recruitment agencies. Dealing with seafarer day rates, hitch rotations, mob/demob logistics, and multi-currency permanent placements can get messy fast, so this app is designed to bring everything into one clean, fast, and human-friendly interface.

---

## What it Does

* **Contract & Hitch Calculator:**
* Takes a consolidated seafarer day rate, adds Employer's NI (with a toggle for Seafarer Exemptions if the vessel is non-UK flagged or operating outside the UK Continental Shelf), and layers on your management fee.
* Allows you to choose between a **Percentage (%)** or **Fixed Flat Rate (£)** for your management fee.
* Features split subsistence so you can separate expensive travel-day subsistence from onboard victualling (which is usually £0 since room and board are covered by the ship).
* Includes a **Hitch & Mob/Demob Scheduler** to easily calculate travel days (with travel-day subsistence always paid at 100% full rate, even on half-days) and standard travel/VISA/agent logistics costs.


* **Permanent Placement Calculator:**
* Quickly calculates fee percentages against candidate salaries across major currencies (GBP, EUR, USD, CHF, AUD, CAD) by automatically fetching live exchange rates from the European Central Bank.


* **Payment Days & Payroll Schedule:**
* Calculates precise payroll split periods and cut-off dates for both monthly and fortnightly cycles (fully synced with UK bank holidays).
* Includes an optional toggle to calculate gross pay based on a day rate, factor in advance deductions, and output a clean **Total Net Pay** summary.



---

## Built With

* **React** (TypeScript)
* **Tailwind CSS** for styling
* **Lucide React** for icons
* **Frankfurter API** for live foreign exchange rates
* **UK Government API** for dynamic bank holiday schedules

---

## Quick Start / Running Locally

1. Drop the calculator component into your React project (making sure your UI path aliases and `<Logo/>` import match your setup).
2. Ensure you have your icon and utility dependencies installed (`lucide-react`, `clsx`, `tailwind-merge`).
3. Fire up your local development server—all state is handled locally with built-in `localStorage` persistence so your preferences stick around between sessions.

---

## Exporting & Sharing Quotes

When you're on the phone with a client or prepping a sheet for your team, you don't want to waste time formatting data.

* **Copy to Clipboard:** Every major breakdown card has a quick-copy button that formats the figures into clean, readable text ready to paste straight into an email or Slack.
* **Print & CSV:** The Payment Days tab features full CSV export and print styling so you can hand over professional schedules without extra hassle.
