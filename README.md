# ping.pe overview

![GitHub License](https://img.shields.io/github/license/hatamiarash7/pingpe-overview) ![GitHub Release](https://img.shields.io/github/v/release/hatamiarash7/pingpe-overview) ![Mozilla Add-on Version](https://img.shields.io/amo/v/ping-pe-overview)

It's an Extension to calculate the global latency from all locations of the current [ping.pe](https://ping.pe) page.

![sc](./.github/sc.png)

## Features

- **Global summary** — mean, median, and p95 of the average latency across every location, plus mean last/best/worst, all colour-coded by health.
- **Exclude China** — drop China nodes from every stat with a single toggle. Your choice is remembered across sessions.
- **Live updates** — statistics refresh automatically as ping results stream in.
- **Highest-latency list** — see the top 5, 10, or 15 slowest locations, with an inline latency bar per node. Your choice is remembered across sessions.
- **Snapshot & compare** — save a run as a baseline, then compare later runs against it to see per-metric and per-location deltas (improved values in green, worse in red). New and removed locations are tagged.
- **Export** — download the per-location data as CSV or JSON, or refresh on demand.

## Usage

1. Visit the [Ping.pe Overview](https://addons.mozilla.org/en-US/firefox/addon/ping-pe-overview/) add-on page and add it to your browser.
2. Open a `ping.pe` ping page, for example [ping.pe/8.8.8.8](https://ping.pe/8.8.8.8), and let the results load.
3. With that tab active, click the extension icon in the toolbar or extension list to see the statistics.

To compare two runs, click **Save** to store the current run as a baseline, run your ping again (or change something and re-run), then turn on the **Compare** toggle to view the differences.

---

## Support 💛

[![Donate with Bitcoin](https://img.shields.io/badge/Bitcoin-bc1qmmh6vt366yzjt3grjxjjqynrrxs3frun8gnxrz-orange)](https://donatebadges.ir/donate/Bitcoin/bc1qmmh6vt366yzjt3grjxjjqynrrxs3frun8gnxrz) [![Donate with Ethereum](https://img.shields.io/badge/Ethereum-0x0831bD72Ea8904B38Be9D6185Da2f930d6078094-blueviolet)](https://donatebadges.ir/donate/Ethereum/0x0831bD72Ea8904B38Be9D6185Da2f930d6078094)

<div><a href="https://payping.ir/@hatamiarash7"><img src="https://cdn.payping.ir/statics/Payping-logo/Trust/blue.svg" height="128" width="128"></a></div>

## Contributing 🤝

Don't be shy and reach out to us if you want to contribute 😉

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## Issues

Each project may have many problems. Contributing to the better development of this project by reporting them.
