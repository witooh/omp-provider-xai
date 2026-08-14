# omp-provider-xai

An [omp](https://github.com/can1357/oh-my-pi) extension that repairs the built-in
`xai-oauth` (SuperGrok / X Premium+) model catalog so **`grok-4.6`** is usable with
its real capabilities.

## The problem

xAI's OAuth `/v1/models` serves `grok-4.6`, but omp 17.2.15 has no curated entry
for it: the id appears nowhere in `@oh-my-pi/pi-catalog`'s `XAI_OAUTH_CURATED_MODELS`
and does not match `GROK_EFFORT_CAPABLE_PREFIXES`
(`grok-3-mini`, `grok-4.20-multi-agent`, `grok-4.3`, `grok-4.5`). The uncurated
discovery result therefore lands with no context window, no vision, no reasoning,
and no reasoning-effort dial:

```
$ omp models xai-oauth --json      # without this extension
grok-4.6   contextWindow=null  maxTokens=null  reasoning=false  input=["text"]  thinking=null
```

## What it does

Registers the corrected catalog under the built-in `xai-oauth` provider id:

```
$ omp models -e ./dist/index.js xai-oauth --json
grok-4.6   contextWindow=500000  maxTokens=500000  reasoning=true  input=["text","image"]
           thinking=["minimal","low","medium","high","xhigh"]
```

Values come from xAI's docs: context window 500 000, text + image input, reasoning
that cannot be disabled, and a `low`/`medium`/`high`/`xhigh` effort ladder. omp's
`minimal` rung maps down to `low`, so the wire only ever carries a tier xAI documents.

The other eight SKUs (`grok-build`, `grok-build-0.1`, `grok-4.3`, `grok-4.5`,
`grok-4.20-*`, `grok-composer-2.5-fast`) are reproduced verbatim from omp's own
curated table. That is required, not decorative: `registerProvider` treats a
non-empty `models` array as a whole-provider replacement, so registering only
`grok-4.6` would delete the rest.

Login, token refresh, and `/usage` keep running through omp's built-in `xai-oauth`
implementation — the extension looks the definition up in omp's registry and
delegates to it rather than re-implementing the device-code flow. The provider id
is unchanged, so the existing stored credential is reused with no second login.

## Install

```bash
omp plugin install github:witooh/omp-provider-xai
```

Pin a release tag:

```bash
omp plugin install github:witooh/omp-provider-xai#v0.1.0
```

Local checkout (dev):

```bash
omp plugin link /path/to/omp-provider-xai
```

Or load it for a single run without installing:

```bash
omp -e /path/to/omp-provider-xai/dist/index.js --model xai-oauth/grok-4.6 --thinking high
```

After install, start a **new** omp session. The extension rebinds `grok-4.6` at
`session_start` so the effort dial (from `modelRoles.default` suffix, or a
restored session level) appears without re-selecting the model.


## Known limitation

`getOAuthProviders()` concatenates built-in and extension-registered providers
without de-duplicating, so `/login` and `/logout` show two `xai-oauth` rows. Both
drive the same credential; the extension's row is labelled `[grok-4.6 catalog]`.

## Development

```bash
npm install
npm run check   # tsc for src and test
npm test        # bun test
npm run build   # esbuild bundle -> dist/index.js
npm run lint    # biome
```
