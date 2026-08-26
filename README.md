# purebox

a small desktop app to quickly create and manage throwaway email addresses using purelymail. made this for my own personal use and ease.

purelymail is great because it has flat ~$10/year pricing, unlimited custom domains, and an api to create/delete real mailboxes without extra fees.

## features

- 1-click throwaway mailbox creation via purelymail api
- auto-detects otp verification codes with 1-click copy
- auto-detects account activation links with 1-click open in browser
- labels / tags per mailbox (e.g. for testing services)
- resizable 3-pane layout with collapsible reader view
- dark/light html reader canvas
- 1-click server-side wipe / delete on purelymail
- real-time imap sync and built-in smtp sender

## how to use

1. get an api token from your purelymail account settings.
2. open settings in the app, paste the token, and click test connection.
3. click new disposable (or press `⌘n` / `g`) to create an email.
4. use the email, receive codes, and delete the account when done.

## shortcuts

- `⌘n` or `g` - new disposable mailbox
- `r` - sync active inbox
- `c` - compose email
- `j` / `k` - navigate messages
- `\` - toggle full view reader
- `[` - toggle mailbox sidebar
- `⌫` or `e` - delete selected email
- `⌘,` - settings

## run locally

```bash
npm install
npm run tauri dev
```
