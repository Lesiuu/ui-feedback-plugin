# UI Feedback plugin for Claude Code

Connects Claude Code to the UI Feedback board at [ui.lesiuu.com](https://ui.lesiuu.com) over MCP. People leave notes on a running site in the board, and your agent reads them, fixes them in the code and reports back on each one.

The plugin contains:

- the `ui-feedback` MCP server (`https://ui.lesiuu.com/mcp`, OAuth sign-in with the same Google account as the board),
- the `fix-ui-notes` skill, which walks the agent through a round of notes,
- a hook that adds the round's git diff to `end_round`, so the agent never writes it.

## Install

```
/plugin marketplace add Lesiuu/ui-feedback-plugin
/plugin install ui-feedback@ui-feedback
```

Then run `/mcp`, pick `ui-feedback` and choose Authenticate. Your Google account must be allowed on the board.

Keep the board open in a browser tab while the agent works: the notes live in that tab, and the server only relays the agent's calls to it.

## Without the plugin

Only the MCP server, with no skill or hook:

```
claude mcp add --transport http ui-feedback https://ui.lesiuu.com/mcp
```
