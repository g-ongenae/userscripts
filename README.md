# userscripts

Userscripts that declutter and add keyboard shortcuts to the sites I use every
day: GitHub, Google Meet and Slides, LinkedIn, Slack, YouTube, Twitch, Reddit,
Hacker News, Demonic Scans and Jinka.

Each script is a single file with no dependencies and `@grant none`. They are
published on [Greasy Fork](https://greasyfork.org/en/users/1663163-guillaume-ongenae).

## Install

1. Install a userscript manager:
   [Violentmonkey](https://violentmonkey.github.io) (Firefox, Chrome, Edge, and
   Firefox for Android) or [Tampermonkey](https://www.tampermonkey.net).
2. Click a script's **Install** link below. The manager shows the script's
   header and asks you to confirm.

The manager checks each script’s source for a higher `@version`.

| Website | Script | Install |
| --- | --- | --- |
| Demonic Scans | [Favorites](https://greasyfork.org/en/scripts/606012-demonic-scans-favorites) — a favorites list without an account, made for a phone | [Install](https://update.greasyfork.org/scripts/606012.user.js) |
| GitHub | Find active forks — an **Active forks** button in repository headers | [Install](https://raw.githubusercontent.com/g-ongenae/userscripts/main/userscripts/github/find-active-forks.user.js) ¹ |
| GitHub | [Fold comments](https://greasyfork.org/en/scripts/604905-github-fold-comments) — fold reviews and comments of pull requests and issues | [Install](https://update.greasyfork.org/scripts/604905.user.js) |
| GitHub | [Fold profile sections](https://greasyfork.org/en/scripts/604906-github-fold-profile-sections) — fold the README and pinned repositories of profiles | [Install](https://update.greasyfork.org/scripts/604906.user.js) |
| GitHub | [Hide the Agents tab](https://greasyfork.org/en/scripts/604907-github-hide-the-agents-tab) — hide the Agents tab and the Copilot buttons | [Install](https://update.greasyfork.org/scripts/604907.user.js) |
| GitHub | [Hide sidebar sections](https://greasyfork.org/en/scripts/604908-github-hide-sidebar-sections) — hide Projects, Milestone, Development and Notifications | [Install](https://update.greasyfork.org/scripts/604908.user.js) |
| GitHub | [Hide repositories from notifications](https://greasyfork.org/en/scripts/604909-github-hide-repositories-from-notifications) — a **Hide** button per repository | [Install](https://update.greasyfork.org/scripts/604909.user.js) |
| GitHub | [Hide bots on pull requests](https://greasyfork.org/en/scripts/604910-github-hide-bots-on-pull-requests) — hide bot and AI comments, resolved threads and events | [Install](https://update.greasyfork.org/scripts/604910.user.js) |
| GitHub | [README tab](https://greasyfork.org/en/scripts/605019-github-readme-tab) — the README in its own tab, Code shows the files only | [Install](https://update.greasyfork.org/scripts/605019.user.js) |
| GitHub | [Zoom pull request images](https://greasyfork.org/en/scripts/606351-github-zoom-pull-request-images) — image files as thumbnails, hover a picture to see it bigger | [Install](https://update.greasyfork.org/scripts/606351.user.js) |
| Google Meet | [Float call controls](https://greasyfork.org/en/scripts/604911-google-meet-float-call-controls) — videos take the whole window | [Install](https://update.greasyfork.org/scripts/604911.user.js) |
| Google Meet | [Keyboard shortcuts](https://greasyfork.org/en/scripts/604912-google-meet-keyboard-shortcuts) — chat, mute the call, layouts, reactions… | [Install](https://update.greasyfork.org/scripts/604912.user.js) |
| Google Slides | [Declutter the editor](https://greasyfork.org/en/scripts/604913-google-slides-declutter-the-editor) — fold the insert rail, close the AI nudge | [Install](https://update.greasyfork.org/scripts/604913.user.js) |
| Hacker News | [Keyboard shortcuts](https://greasyfork.org/en/scripts/605852-hacker-news-keyboard-shortcuts) — move, open, fold from the keyboard | [Install](https://update.greasyfork.org/scripts/605852.user.js) |
| Jinka | [Keyboard shortcuts](https://greasyfork.org/en/scripts/607483-jinka-keyboard-shortcuts) — browse listings and photos, toggle favorites, and change results pages | [Install](https://update.greasyfork.org/scripts/607483.user.js) |
| Jinka | [Transport and motorways](https://greasyfork.org/en/scripts/607490-jinka-transports-et-autoroutes) — toggle transit lines and motorways, and estimate travel times from listing pins | [Install](https://update.greasyfork.org/scripts/607490.user.js) |
| LinkedIn | [Better post composer](https://greasyfork.org/en/scripts/604914-linkedin-better-post-composer) — full-window composer, bold / italic / strikethrough | [Install](https://update.greasyfork.org/scripts/604914.user.js) |
| LinkedIn | [Declutter & wide feed](https://greasyfork.org/en/scripts/604915-linkedin-declutter-wide-feed) — hide upsells and side columns, widen the feed | [Install](https://update.greasyfork.org/scripts/604915.user.js) |
| LinkedIn | [Keyboard shortcuts](https://greasyfork.org/en/scripts/604916-linkedin-keyboard-shortcuts) — move between posts, react, comment, repost… | [Install](https://update.greasyfork.org/scripts/604916.user.js) |
| Reddit | [Declutter](https://greasyfork.org/en/scripts/606132-reddit-declutter) — hide side columns, ads and sign-in prompts | [Install](https://update.greasyfork.org/scripts/606132.user.js) |
| Slack | [Declutter](https://greasyfork.org/en/scripts/604917-slack-declutter) — hide sidebar entries, fold file previews | [Install](https://update.greasyfork.org/scripts/604917.user.js) |
| Slack | [Fold sidebar](https://greasyfork.org/en/scripts/604918-slack-fold-sidebar) — a button folding the sidebar | [Install](https://update.greasyfork.org/scripts/604918.user.js) |
| Slack | [Upload shortcut](https://greasyfork.org/en/scripts/604919-slack-upload-shortcut) — Cmd/Ctrl+U opens the file picker | [Install](https://update.greasyfork.org/scripts/604919.user.js) |
| Twitch | [Followed channels on the home page](https://greasyfork.org/en/scripts/604920-twitch-followed-channels-on-the-home-page) — no carousel, no recommendations | [Install](https://update.greasyfork.org/scripts/604920.user.js) |
| YouTube | [Comment icon buttons](https://greasyfork.org/en/scripts/606338-youtube-comment-icon-buttons) — translate and read more as icons next to Reply | [Install](https://update.greasyfork.org/scripts/606338.user.js) |
| YouTube | [Fold related videos](https://greasyfork.org/en/scripts/604921-youtube-fold-related-videos) — the video takes the right column's space | [Install](https://update.greasyfork.org/scripts/604921.user.js) |
| YouTube | [Keyboard shortcuts](https://greasyfork.org/en/scripts/606350-youtube-keyboard-shortcuts) — move between comments, reply, show replies | [Install](https://update.greasyfork.org/scripts/606350.user.js) |
| YouTube | [Subscriptions on the home page](https://greasyfork.org/en/scripts/604922-youtube-subscriptions-on-the-home-page) — your channels instead of an empty feed | [Install](https://update.greasyfork.org/scripts/604922.user.js) |

¹ Not on Greasy Fork: a rewrite of [Celuni's script](https://greasyfork.org/scripts/397171),
installed and updated from this repository.

What each script does, in detail, and the settings at the top of some of them:
[docs/scripts.md](docs/scripts.md).

## Repository layout

```text
.github/workflows/   # lint and version checks on every push and pull request
.github/scripts/     # the @version check and its test
docs/                # what each script does; how to change and publish one
userscripts/<website>/<name>.user.js
LICENSE.md
README.md
```

To change a script, lint it and publish it, see
[docs/development.md](docs/development.md).

## License

[MIT](LICENSE.md).
