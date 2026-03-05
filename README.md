<h1 align="center">
<sub>
<img src="src/resources/icons/enabled-38.png" height="38" width="38">
</sub>
AdBlocker Ultimate for Browsers
</h1>

AdBlocker Ultimate is a free extension that blocks ads, malicious domains known to spread malware, and disables tracking. We have included a few extensive filters that offer decent protection against annoying, flashy ads, YouTube commercials, and more. Unlike other adblockers we do not have a whitelist for websites (a.k.a. "Acceptable ads"). Blocking ads will speed up your website load speed, decrease CPU and memory usage.

The extension allows you to switch back on ads for your favorite websites in case you know there are no intrusive and/or misleading advertising there.

## Features

* Blocks all ads
* Blocks malware and disables tracking
* Faster page loads and lower memory usage
* No "acceptable ads" — zero exceptions
* Supports Chrome (MV2 & MV3), Firefox, and Edge

## Why another AdBlocker?

AdBlocker Ultimate was created with the sole purpose to block ALL ads. Many adblockers are affiliated with ad networks bypassing ads for a fee. We couldn't find an adblocker blocking everything, so we just decided to make our own, filtering every ad without exceptions. That is how the idea of AdBlocker Ultimate was born.

## Contribute

**Found an issue?**

Report the problem on our [website](https://adblockultimate.net/report)

## Contact us

You can drop us a line [here](https://adblockultimate.net/contact)

## Install

`pnpm install` - downloads necessary dependencies

## Usage

`pnpm dev` - development build for all browser targets

`pnpm release` - release build for all browser targets

`pnpm resources` - download and process filter resources for MV2

`pnpm resources:mv3` - download and process filter resources for MV3

`pnpm lint` - run ESLint

## Dependencies

* [agtree](https://www.npmjs.com/package/@adguard/agtree)
* [filters-downloader](https://www.npmjs.com/package/@adguard/filters-downloader)
* [logger](https://www.npmjs.com/package/@adguard/logger)
* [scriptlets](https://www.npmjs.com/package/@adguard/scriptlets)
* [text-encoding](https://www.npmjs.com/package/@adguard/text-encoding)
* [tsurlfilter](https://www.npmjs.com/package/@adguard/tsurlfilter)
* [tswebextension](https://www.npmjs.com/package/@adguard/tswebextension)
* [preact](https://www.npmjs.com/package/preact)
* [signals](https://www.npmjs.com/package/@preact/signals)
* [crypto-js](https://www.npmjs.com/package/crypto-js)
* [file-saver](https://www.npmjs.com/package/file-saver)
* [nanoid](https://www.npmjs.com/package/nanoid)
* [webextension-polyfill](https://www.npmjs.com/package/webextension-polyfill)
* [idb](https://www.npmjs.com/package/idb)
* [lodash-es](https://www.npmjs.com/package/lodash-es)

## License

AdBlocker Ultimate is an open source project licensed under [GPL v3](LICENSE).
