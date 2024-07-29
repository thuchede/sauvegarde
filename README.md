# sync-photo

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.0.1. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

# TODO

- [ ] log file upload error to file 
- [ ] split log level [err|warn|info]
- [ ] clean up dry run to a nicer output 
- [x] add inquirer checkbox ~~swap commander for clack~~
- [x] allow selecting the folder you want to sync
- [ ] add ignore flag (list of folder or regex?)
- [ ] option to pass credentials file
