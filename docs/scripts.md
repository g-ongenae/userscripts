# Scripts

What each userscript does. Install links are in the [README](../README.md#install).
Some scripts have settings, as constants at the top of the file: edit them in
your userscript manager. An update from Greasy Fork overwrites the edit.

## Demonic Scans

### [`demonicscans/favorites.user.js`](../userscripts/demonicscans/favorites.user.js)

Keeps a list of favorite titles on [Demonic Scans](https://demonicscans.org),
without an account. Made for a phone's browser: Violentmonkey runs on Firefox
for Android.

Each title page gets an **Add to favorites** button under the site's own
Bookmark button, and a star in the navigation bar opens the list: each title
with its cover, its latest chapter (a link to it) and that chapter's date, most
recent first, dates of the last day highlighted. From a chapter being read, the
list also offers to add its title. Opening the list reads again the latest
chapters read more than an hour ago (`STALE_MS`), and its refresh button reads
them all; the star of a row removes the title, with an **Undo**, and the
phone's back button closes the list. The favorites are kept in the site's
storage on that browser only: clearing the site's data erases them.

## GitHub

### [`github/find-active-forks.user.js`](../userscripts/github/find-active-forks.user.js)

Adds an **Active forks** button to GitHub repository headers, opening
[active-forks](https://techgaun.github.io/active-forks/) for the repository.
A rewrite of [Celuni's script](https://greasyfork.org/scripts/397171) for
GitHub's current header. It is not published on Greasy Fork.

### [`github/fold-comments.user.js`](../userscripts/github/fold-comments.user.js)

Adds a chevron button to the header of each review, comment, review comment and
description of GitHub pull requests (the Overview preview and the classic
conversation) and issues; it folds it down to its header (a review with its
comment and its threads), and Alt-click folds or unfolds every comment of the
page. Each choice is remembered.

### [`github/fold-profile.user.js`](../userscripts/github/fold-profile.user.js)

Folds the README (folded by default) and the pinned repositories on GitHub user
and organization profiles down to their headers; a chevron button in each
header unfolds it (next to the edit pencil on your own README), and each state
is remembered.

### [`github/hide-agents-tab.user.js`](../userscripts/github/hide-agents-tab.user.js)

Hides the **Agents** tab of GitHub repository navigation bars, its entry in the
overflow menu shown on narrow windows, the **Copilot** button (and its
dropdown) of the page header, the Copilot panel button of the pull request
header, and the **Ask about this diff** button of each file in the pull request
diff.

### [`github/hide-sidebar-sections.user.js`](../userscripts/github/hide-sidebar-sections.user.js)

Hides the **Projects**, **Milestone**, **Development** and **Notifications**
sections of the sidebar of GitHub pull requests (the Overview preview and the
classic conversation) and issues, leaving the reviewers, assignees, labels and
participants.

### [`github/notifications-hide-repos.user.js`](../userscripts/github/notifications-hide-repos.user.js)

Adds a **Hide** button to the header of each repository group of the GitHub
notifications page; the repository's notifications stay hidden after a reload.
A crossed-out eye next to the repository in the sidebar shows it again, and
filtering on the repository still lists its notifications. Hiding is
display-only: hidden notifications still count in the inbox badge.

### [`github/pr-hide-bots.user.js`](../userscripts/github/pr-hide-bots.user.js)

Adds a **Hide bots** button to pull request conversations: left of
**All / Unresolved / Mine** on the Overview preview, in the page header on the
classic conversation (`?overview=false`). Unlike GitHub's own **Show AI and bot
comments** filter, it keeps the SonarCloud and algoanbot reports (OpenAPI
changes…) and hides the replies Claude wrote.

It hides the comments and reviews of bots and AI reviewers (Copilot,
CodeRabbit, Claude…, but not SonarCloud, Socket and algoanbot), the replies
posted with a `Co-Authored-By: Claude … <noreply@anthropic.com>` signature or a
`🤖 Generated with Claude Code` footer, the `@coderabbitai review` (or
`full review`) commands, the resolved threads and the timeline events (labels,
review requests, draft/ready…; the Overview moves them to the sidebar's
Activity). It leaves the description, the commits, the human comments and
reviews, the linked or mentioning issues and pull requests, and the merge. A
thread a human answered stays, with the comment it answers. The button shows
how many items are hidden, and the choice is remembered.

### [`github/readme-tab.user.js`](../userscripts/github/readme-tab.user.js)

Moves the README of GitHub repositories (and directories) into its own
**README** tab, first in the repository navigation bar: **Code** shows the
files only, **README** shows the README with its License / Code of conduct tabs
instead of the files. The tab opens on `#readme-ov-file` (also the sidebar's
**Readme** link), so it can be linked to and survives a reload; from the other
tabs it goes to the repository home. The repository home opens on **README**
when it has one (unless reached through **Code**); directories open on their
files. Where the page has no README (a repository or directory without one, a
404 page), the tab is greyed out and Code is shown.

## Google

### [`google/meet-float-controls.user.js`](../userscripts/google/meet-float-controls.user.js)

Gives the videos the whole window in a Google Meet call: the tiles stretch over
the room Meet keeps for its bottom bar and its 16:9 boxes (cameras are cropped
to fit, screen shares letterboxed), and the call controls with the reactions
row either float over the bottom of the video, fading out when the mouse rests,
or fold out of sight against the left edge, opening when the mouse touches it.
A button left of the controls switches between docked (Meet's own layout),
floating and side, and the choice is remembered. It also hides the Gemini
button at the bottom left.

Settings: `DEFAULT_MODE`, `SIDE`, `FILL` and `HIDE_GEMINI`.

### [`google/meet-keyboard.user.js`](../userscripts/google/meet-keyboard.user.js)

Drives a Google Meet call from the keyboard (it also runs on Google Chat and
Gmail's chat):

| Key | Action |
| --- | --- |
| **c** | open the chat with the cursor in its message box (**Esc** leaves it, **Cmd/Ctrl+Esc** closes the chat) |
| **m** | mute or unmute the sound of the call, not your microphone (which stays on **Cmd+D**); a red badge shows while it is off |
| **h** | hide your own video (Meet's **Minimize**, closing the notice that follows) or show it again |
| **v** | switch to the next layout: Auto, Tiled, Spotlight, Sidebar, then back |
| **f** | toggle full screen |
| **s** | toggle the captions |
| **t** | toggle the translation (closing Meet's panel afterwards) |
| **p** | present your screen |
| **l** | react with 👍 |
| **r** | open Meet's emoji picker with the cursor in its search; held, show Meet's nine reactions to pick with **1**–**9** |
| **?** | list the shortcuts, Meet's own included |

### [`google/slides-declutter.user.js`](../userscripts/google/slides-declutter.user.js)

Gives the slide more room in the Google Slides editor: it folds away the insert
rail on the right of the slide (Slide, Image, Media, Uploads, Convert to video,
all still in the **Insert** menu) and hands its room to the slide; a chevron at
the end of the toolbar, like the filmstrip one, folds it (`>`) and brings it
back (`<`), and the choice is remembered. It also closes the **Enhance this
slide** AI button under the slide whenever it shows up.

Settings: `FOLD_RAIL_BY_DEFAULT` and `CLOSE_AI_NUDGE`.

## Hacker News

### [`hackernews/keyboard.user.js`](../userscripts/hackernews/keyboard.user.js)

Drives Hacker News from the keyboard:

| Key | Action |
| --- | --- |
| **j** / **k** (or **↓** / **↑**) | move to the next / previous story, or comment in a discussion (highlighted, skipping folded replies) |
| **o** | open its link in a new tab (a comment's first link) |
| **d** | open its discussion |
| **f** | fold or unfold a comment with its replies |
| **n** | go to the next page |
| **.** / **t** | go to the top |
| **r** | reload |
| **h** | open the home page |
| **Esc** | leave the comment box |
| **?** | list the shortcuts |

## LinkedIn

### [`linkedin/compose.user.js`](../userscripts/linkedin/compose.user.js)

Makes LinkedIn's **Start a post** dialog fill the window; adds **B**, **I** and
**S** buttons (and **Cmd/Ctrl+B**, **Cmd/Ctrl+I**, **Cmd/Ctrl+Shift+X**, which
also work in comments) that toggle bold, italic or strikethrough on the
selection with Unicode letters and marks, as posts are plain text; shows
attached images as a row of thumbnails at the bottom; and counts the words and
characters of the post against the 3,000 characters limit. Unicode bold,
italic and struck-through letters are poorly read by screen readers and are
not found by LinkedIn's search.

### [`linkedin/declutter.user.js`](../userscripts/linkedin/declutter.user.js)

Hides LinkedIn's Jobs, For Business and Premium upsells, the footer links, the
ad library card of company pages, the right rail and "Recommended for you"
cards; widens the feed and single posts, and lays out the posts of company and
profile pages like the feed; moves the post composer under **Saved items**;
shows post images beside the text with an expand button; adds panel buttons at
the page edges that fold away the left column of the feed and the side column
of company and profile pages (**People also viewed**, …; folded by default),
remembering their state; removes **Show translation** on French and English
posts; pauses off-screen videos; and, since LinkedIn keeps every loaded post in
memory, stops the feed after 50 posts with a **Load a fresh feed** button.

Settings: `FRESH_FEED_AFTER`.

### [`linkedin/keyboard.user.js`](../userscripts/linkedin/keyboard.user.js)

Drives LinkedIn from the keyboard:

| Key | Action |
| --- | --- |
| **j** / **k** (or **↓** / **↑**) | move to the next / previous post (outlined) |
| **l** | like it; held, show a reaction picker (**t y u i o p** for Like, Celebrate, Support, Love, Insightful and Funny; **l** or **Esc** cancels) |
| **c** | open its comment box |
| **r** | repost it with your thoughts (in the composer) |
| **s** | copy its link |
| **o** | open it |
| **e** | expand or collapse its text |
| **←** / **→** | browse its images or document pages |
| **Space** / **m** | play or pause its video / mute or unmute it |
| **p** | start a post |
| **t** / **b** | go to the top / bottom of the page |
| **h** / **u** | open the feed / your profile |
| **Cmd/Ctrl+U** | in a post or comment being written, add an image |
| **Esc** | leave a comment box |
| **?** | list the shortcuts |

## Reddit

### [`reddit/declutter.user.js`](../userscripts/reddit/declutter.user.js)

Hides Reddit's sign-up panel on the left (shown logged out; the navigation
shown logged in stays), the right column (related posts, community card, footer
links), ads, the feed of other posts under the comments and Google's sign-in
pop-up, giving their room to the main column; on a post's own page, it shows
the whole text without **Read more**. Each part has a setting at the top of the
script.

## Slack

### [`slack/declutter.user.js`](../userscripts/slack/declutter.user.js)

Hides Slack's **Find a conversation** filter, the **Huddles**, **Later** and
**Directories** entries of the sidebar, and the **Help** button of the top bar,
closing the gaps they leave; it also folds image and file previews in messages
down to their file name.

### [`slack/fold-sidebar.user.js`](../userscripts/slack/fold-sidebar.user.js)

Adds a button left of the back/forward arrows of Slack's top bar that folds the
sidebar (workspace name, channels, direct messages…) so the conversation takes
the whole width; the last state is remembered.

### [`slack/upload-shortcut.user.js`](../userscripts/slack/upload-shortcut.user.js)

Makes **Cmd+U** (**Ctrl+U** off macOS) open the file picker of the message
composer being typed in (or of the open conversation), like **Upload from your
computer** in its **+** menu. It leaves the shortcut alone when the focus is in
another input, such as the search box.

Settings: `MODIFIER`.

## Twitch

### [`twitch/home-following.user.js`](../userscripts/twitch/home-following.user.js)

Replaces the Twitch home page (featured carousel, recommended streams and
categories) with the channels you follow: live ones as stream cards, busiest
first, the others as avatars, most recently live first. The carousel and
recommendations are not even fetched, so the carousel's live stream never
plays, and the side bar keeps only the followed channels. It also hides the
top bar's More options, Prime offers, Bits and Turbo buttons, and on channel
pages the Bits, upgrade and gift sub buttons, the goals, the goal and
leaderboard banner atop the chat and the Bits, points and bonus buttons under
it.

## YouTube

### [`youtube/fold-related.user.js`](../userscripts/youtube/fold-related.user.js)

Folds the right column of a YouTube video (filter chips and related videos) so
the video takes its space; a small round button on the right edge unfolds it,
and the last state is remembered.

### [`youtube/home-subscriptions.user.js`](../userscripts/youtube/home-subscriptions.user.js)

Fills the empty YouTube home page (watch history off) with a grid of your
subscribed channels, read from the sidebar; channels with new videos come first
and carry a blue dot.
