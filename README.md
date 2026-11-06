# Jeff Kharrat portfolio

Character rigging and technical animation. Static site served by GitHub Pages.

- `index.html`: the whole site. Contact details, projects and media paths are in the `EDIT HERE` block near the bottom.
- An intro plays behind the home page on load, picked at random from `SITE.intros`: origin, vault, bloom, gimbal, matrix, hyper (tesseract to the 120-cell, flown through from inside S³) and hopf (a sheet glued into a torus, then the Hopf fibration). `?intro=hyper&at=9.5` plays one intro and freezes it at that second. `SITE.intro` in the same block sets it to `'always'`, `'once'` or `'off'`; its code is the `origin sequence` section of the script.
- `media/`: clips, images and CV files.
- `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`: the tab and home-screen icon, the カラット mark (three scales in a ring, after the Hōjō crest). If you change them, raise the `?v=` number on the icon links in `index.html` so browsers fetch the new files.

## License

All rights reserved. See `LICENSE`: the code, artwork, characters and media here may not be reused without permission.
