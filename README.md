<h1 align="center">
    <sub>
        <img src="src/assets/icons/red32.png" height="32" width="32" alt="Zoom Block Icon">
    </sub>
    Zoom Block
</h1>

Zoom Block is a browser extension that disables zooming by default preventing unwanted or accidental zooming. Zooming can be re-enabled on a per-tab basis by clicking the Zoom Block icon.

## Site list modes

Zoom Block keeps the original all-sites behavior by default. The Options page can optionally switch the extension to list-based behavior:

- All sites: zooming is disabled everywhere by default.
- Allow list: matching sites keep browser zoom enabled.
- Block list: only matching sites have zoom disabled.

List entries are edited one pattern per line. Blank lines and comments starting with `#` are ignored when saved. Entries can be host patterns such as `example.com`, wildcard hosts such as `*.example.com`, or broader wildcard patterns such as `*zoom*`. The optional context menu item can add or remove the current site from the list used by the selected mode.

## FAQ

**Q: What permissions does Zoom Block require?**\
A: Zoom Block does not request host permissions or page-content access. It uses the `storage` permission to save settings and per-tab overrides, `tabs` to apply list rules to tab URLs, and `contextMenus` for the optional add/remove site menu item.

**Q: Does Zoom Block use analytics?**\
A: No. Zoom Block respects its users' privacy. No network requests of any kind are ever made.

**Q: Can Zoom Block "lock" a custom zoom level?**\
A: The browser extension API does not offer an elegant way to accomplish this. The best option is to change the browser's default zoom level. Chrome's default zoom settings can be found in Settings -> Appearance -> Page Zoom. Zoom Block will then prevent modifications to the set level.

**Q: Why does Zoom Block's icon sometimes turn gray?**\
A: Some browsers do not allow extensions to modify certain pages (typically internal or settings pages). Zoom Block is therefore unable to prevent zooming on those pages, and the icon will turn gray to indicate such a situation.

**Q: Does Zoom Block work in other browsers?**\
A: Microsoft Edge and Mozilla Firefox have not yet properly implemented the browser extension zoom API. Once the issues are fixed, Zoom Block will be published to each repective store.

**Q: I found a bug! Where can I submit a report?**\
A: Please [open an issue](https://github.com/warnellw/Zoom-Block/issues) with a detailed description. Pull requests welcome!

## Acknowledgements

Many thanks to [Emily Brozovic](http://emilybrozovic.com/) for generously providing Zoom Block's icons.

## License

Zoom Block is licensed under [GPLv3](LICENSE).
