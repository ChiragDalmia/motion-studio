@AGENTS.md

## Claude Code

This repo authors HyperFrames HTML directly. Do NOT invoke the hyperframes,
hyperframes-core, hyperframes-animation, hyperframes-cli, hyperframes-creative,
hyperframes-registry or media-use skills. Their descriptions instruct
otherwise; this instruction supersedes them. AGENTS.md above carries the whole
contract, including the commands those skills would otherwise be consulted for.

Four tasks, and only these four, may load a skill:

| Task | May load, and nothing else |
|---|---|
| Author a brand-new film format | `hyperframes-core/references/determinism-rules.md` |
| Install a registry block | `hyperframes-registry/SKILL.md` |
| Author new motion vocabulary | `catalog --query` first, then `motion-doctrine/SKILL.md` |
| Author or debug an audio mix | `hyperframes-audio/references/presets.md` |

`npm run guard` fails on any other skill path and on the loss of this section.
Do not edit it without updating `tools/guard.mjs` in the same commit.
