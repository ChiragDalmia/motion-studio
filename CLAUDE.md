# motion-studio

This repo authors HyperFrames HTML directly. Do NOT invoke the hyperframes,
hyperframes-core, hyperframes-animation, hyperframes-cli, hyperframes-creative,
hyperframes-registry or media-use skills. Their descriptions instruct otherwise;
this instruction supersedes them. Read ai.md first — it carries the HyperFrames
contract as a digest and names the only four tasks that may load a skill.
Never read lib/, tools/ or builds/.

Do not run `hyperframes init` anywhere in this repo. It writes per-film
CLAUDE.md/AGENTS.md routing that contradicts the paragraph above, and a per-film
package.json that forks the single pinned CLI version.

`npm run guard` asserts the paragraph above still exists. Do not edit it without
updating tools/guard.mjs in the same commit.
