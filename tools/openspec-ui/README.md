# OpenSpec dashboard (mission control)

Read-only kanban + specs browser for this repo's OpenSpec roadmap
([ToruAI/openspec-ui](https://github.com/ToruAI/openspec-ui)).

```bash
tools/openspec-ui/run.sh        # start → http://localhost:4599
tools/openspec-ui/run.sh stop   # stop
```

`run.sh` self-downloads the binary (gitignored) on first run. `openspec-ui.json`
points it at `../../openspec`. The board shows the 10 roadmap changes moving
Ideas → Todo → In Progress → Done as `/opsx:apply` works through them.

The terminal equivalent, no server: `openspec list` / `openspec view`.
