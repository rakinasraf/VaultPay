# 💎 VaultPay – Mobile Financial Services & Online Banking
bKash/Nagad/Rocket-style platform (Customer · Agent · Merchant · Platform Admin) built with **HTML + CSS + JavaScript only**.
Theme: *Money in the Vault* (gold, diamonds, flying money) with a Light/Dark toggle.

## Run
Open `index.html` (no server or database needed). Data is stored in the browser's `localStorage`.

## Demo logins (PIN 12345, OTP 1234)
| Role | Mobile | Password |
|---|---|---|
| Admin | 01700000000 | admin123 |
| Customer | 01711111111 | 1234 |
| Agent | 01733333333 | 1234 |
| Merchant | 01744444444 | 1234 |

## Publish on GitHub Pages
1. Create a repo, push these files (`git add . && git commit -m "VaultPay" && git push`).
2. Repo → Settings → Pages → Branch `main` / root → Save. Your site goes live at `https://<user>.github.io/<repo>/`.

## Notes
All money moves through one `pay()` function: PIN check + 3-attempt lock, per-txn/daily limits (lower until KYC verified), fees, agent commission, unique TrxID, append-only ledger (reversals are new entries), fraud rules, audit log.
Passwords/PINs use a demo hash and OTP/bank/biller links are simulated – a real deployment needs a server (PHP/MySQL as in the original spec).
