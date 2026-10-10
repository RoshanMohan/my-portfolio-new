# Bookmarks setup

Your bookmarks live in a Google Sheet. You add one by emailing a link to yourself, a script
files it into the Sheet, and the website shows it. One-time setup takes about 5 minutes.

## 1. Create the Sheet

Create a new Google Sheet and name it **Bookmarks**. Leave its sharing set to **Restricted**.

## 2. Add the script

1. In the Sheet, open **Extensions → Apps Script**.
2. Delete the sample code, then paste in everything from `tools/bookmarks/apps-script.gs`.
3. Click **Save**.

## 3. Run setup once

1. In the function dropdown at the top, choose **setup**, then click **Run**.
2. Google asks for permission. Click **Review permissions**, choose your account, then
   **Advanced → Go to Bookmarks (unsafe)** → **Allow**.
   It's marked "unsafe" only because it's your own script and Google hasn't reviewed it.
   It needs Gmail access to read your bookmark emails, and Sheets access to write rows.

This creates the **Public** and **Private** tabs and sets the script to check your email every 10 minutes.

## 4. Publish the Public tab

1. In the Sheet, open **File → Share → Publish to web**.
2. Change **Entire Document** to **Public**, and **Web page** to **Comma-separated values (.csv)**.
3. Click **Publish** and copy the link.
4. In `js/bookmarks.js`, paste the link between the quotes:
   `var BOOKMARKS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/…/pub?gid=0&single=true&output=csv';`
5. Commit and push this change. It's the last code change bookmarks will ever need.

Only the Public tab is published. The Private tab and the rest of the Sheet stay private.

## Adding a bookmark

Send an email **from your Gmail** to your address with `+bookmarks` added,
e.g. `yourname+bookmarks@gmail.com`. On your phone, use **Share → Mail** from any app.

| Where       | What to put                                                        |
|-------------|--------------------------------------------------------------------|
| Body        | The link, plus an optional note: why you recommend it              |
| Subject     | Optional. Also used as a note, unless it's just the page title     |
| `#tags`     | Optional, anywhere in the email                                    |

**Type tags:** `#video` `#channel` `#course` `#blog` `#article` `#paper` `#book` `#podcast` `#tool`.
Without one, the type is guessed from the link (YouTube → Video or Channel, PDF → Paper, Amazon → Book…).

**`#private`** adds it to the Private tab. It's for your own reference and never appears on the website.

New bookmarks show on the site within about 15 minutes: up to 10 for the script to run,
plus up to 5 for Google to refresh the published file.

Processed emails get the label **bookmarks-added** and are archived. Emails to this address
from anyone else are ignored. To allow another address of yours, add it to `EXTRA_SENDERS`
at the top of the script.

## Editing

Edit the Sheet directly: fix a title, rewrite a note, change a type, or delete a row.
The website picks up changes on the next refresh. Keep the header row as it is.
