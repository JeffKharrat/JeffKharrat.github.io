# Jeff Kharrat portfolio

Character rigging and technical animation. Static site served by GitHub Pages.

- `index.html`: the whole site. Contact details, projects and media paths are in the `EDIT HERE` block near the bottom.
- An intro plays behind the home page on load, picked at random from `SITE.intros`: origin, vault, bloom, gimbal, matrix, hyper (tesseract to the 120-cell, flown through from inside S³) and hopf (a sheet glued into a torus, then the Hopf fibration). `?intro=hyper&at=9.5` plays one intro and freezes it at that second. `SITE.intro` in the same block sets it to `'always'`, `'once'` or `'off'`; its code is the `origin sequence` section of the script.
- Phones and small tablets (under 64rem) get their own layout, at the end of the stylesheet: the stage opens the home page in the flow instead of being pinned (pinned, it covered the panels under it), its four layers are switched by the buttons under it and play on their own until one is tapped, and the main navigation is a tab bar at the bottom. The wide layout is not affected.
- `media/`: clips, images and CV files.
- `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`: the tab and home-screen icon, the Yeff sigil. If you change them, raise the `?v=` number on the icon links in `index.html` so browsers fetch the new files.

## License

All rights reserved. See `LICENSE`: the code, artwork, characters and media here may not be reused without permission.
