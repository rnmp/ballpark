# Ballpark 

The simplest net worth tracker imaginable, built on web tech and zero dependencies

## Features

- Import/export: own the data that Ballpark creates
- Undo/redo: great for experimentation or hypothetical scenarios
- Minimalist UI: as little clutter as possible, anything else is opt-in
- Customizable: multiple currencies, themes, etc.

## Development

All business logic takes place in `main.js`, though running index.html on a browser should 
be enough to preview changes. If you want to auto-reload your changes, feel free to install 
the package.json dependencies and run `node watch.cjs`.
