# Security

## Reporting a vulnerability

Report privately through this repository's GitHub Security Advisories, under
the Security tab, rather than opening a public issue. Include the film or tool
affected, what you ran and what happened. Expect an acknowledgement within five
working days.

## What this repository produces

Each build is a single self-contained HTML file. It makes zero network
requests, carries a restrictive `Content-Security-Policy` in a `<meta>` tag,
and talks to no third party. Gate 2 measures all of that on the shipped bytes
rather than trusting it.

A film is meant to be embedded as its own document. Serving one with `srcdoc`
or a `data:` URL makes it inherit the host page's policy, and Content-Security
Policies only ever intersect, so the film's own policy can never grant back
what the host denied. README.md has the three host requirements.

## Secrets

No credential belongs in this repository. `.env` is gitignored and
`.env.example` lists the optional authoring keys by name with empty values. No
build step and no gate reads any of them; a cache miss is a build failure, not
a fetch.

`npm run guard` fails on anything in a tracked file that looks like an API key,
a token or a private key, and on any absolute path from someone's home
directory. If a key ever does reach a commit, rotate it first and clean the
history second: the rotation is what makes it safe, not the rewrite.

## Dependencies

Four pinned devDependencies, exact versions, installed with `npm ci` from the
committed lockfile. There are no runtime dependencies: the built film needs no
library on the page. `npm run guard` fails on a version range, on a second
`package.json`, and on a dependency that is not pinned exactly.
