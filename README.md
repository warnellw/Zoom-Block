<h1 align="center">
    <sub>
        <img src="icons/red38.png" height="38" width="38" alt="Zoom Block Icon">
    </sub>
    Zoom Block
</h1>

Zoom Block is a browser extension that disables zooming by default preventing unwanted or accidental zooming. Zooming can be re-enable on a per-tab basis by clicking the Zoom Block icon.

## FAQ

**Q: What permissions does Zoom Block require?**\
A: Zoom Block does not require any permissions. Through careful handling of errors, Zoom Block is able to operate without access to any sensitive information.

**Q: Does Zoom Block use analytics?**\
A: No. Zoom Block respects its users' privacy. No network requests of any kind are ever made.

**Q: Can Zoom Block "lock" a custom zoom level?**\
A: The browser extension API does not offer an elegant way to accomplish this. The best option is to change the browser's default zoom level. Chrome's default zoom settings can be found in Settings -> Appearance -> Page Zoom. Zoom Block will then prevent modifications to the set level.

**Q: Why does Zoom Block's icon sometimes turn grey?**\
A: Some browsers do not allow extensions to modify certain pages (typically internal or settings pages). Zoom Block is therefore unable to prevent zooming on those pages, and the icon will turn grey to indicate such a situation.

**Q: Does Zoom Block work in other browsers?**\
A: Microsoft Edge and Mozilla Firefox have not yet properly implemented the browser extension zoom API. Once the issues are fixed, Zoom Block will be published to each repective store.

**Q: I found a bug! Where can I submit a report?**\
A: Please [open an issue](https://github.com/warnellw/ZoomBlock/issues) with a detailed description. Pull requests welcome!

## License

Zoom Block is licensed under [GPLv3](license.txt).