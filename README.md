# Keeta Network Explorer

The explorer has three apps:

- `apps/server`: the explorer's API ([Hono](https://hono.dev)), and the
  `@keetanetwork/explorer-client` package the web app uses to call it
- `apps/web`: the web app (Preact and preact-iso), which reads the network
  directly through the KeetaNet client
- `apps/cloud`: the deployment

## Development

Use the Node.js version in `.nvmrc` or later.

```sh
make do-dev-server    # or: npx tsx scripts/start-dev-server.ts
```

starts the API on http://localhost:3010 (`API_PORT`) and the web app on
http://localhost:3011 (`CLIENT_PORT`). `make test` in `apps/server` runs the
server's tests.

### A local network, with contracts

Contracts (sBPF programs representatives run) exist only on a local
development network, such as the one `utils/local-network.mjs` in the node
repository runs. The explorer can be pointed at one in development; production
builds and the dev, test, staging and main networks are unchanged, and show no
contracts.

1. Install the apps' dependencies (`npm ci` in `apps/server` and `apps/web`),
   then, from this directory, replace the KeetaNet client in each with one built from the node's
   contract branch, which knows the contract operations:

   ```sh
   (cd ~/Projects/keeta/node && make built/keetanet-clientlib.tar.gz)
   for app in apps/server apps/web; do
     (cd "$app" && npm install --no-save ~/Projects/keeta/node/built/keetanet-clientlib.tar.gz)
   done
   ```

   The tarball is `@keetanetwork/keetanet-client` as a release publishes
   it. If `npm ls @keetanetwork/keetanet-client` shows another copy (such as
   one nested under `@keetanetwork/anchor/node_modules`), unpack the tarball
   in its place too (`tar -xzf <tarball> -C <that directory> --strip-components=1`).

   Reinstalling dependencies puts npm's client back, so do this again after
   any reinstall: `npm install`/`npm ci`, `make` in `apps/server` after its
   `Makefile`, `package.json` or `npm-shrinkwrap.json` change, and
   `make do-dev-server` (or `make dist`) in `apps/web`, which reinstalls each
   time.

2. Start the explorer with the network's `endpoints.json` and, optionally, a
   contract verifier:

   ```sh
   KEETA_LOCAL_NETWORK=~/.local/state/keeta-pet/network/endpoints.json \
   KEETA_CONTRACT_VERIFIER_URL=http://localhost:3091 \
   npx tsx scripts/start-dev-server.ts
   ```

   The local network takes the place of the network whose alias it uses (the
   test network's), in the API and the web app; the web app starts without
   reinstalling its dependencies, so the client installed above stays.

The script sets these, which can also be set by hand:

| App    | Variable                     | Value                                                                      |
|--------|------------------------------|----------------------------------------------------------------------------|
| server | `APP_LOCAL_NETWORK`          | Path of the local network's `endpoints.json`                               |
| server | `APP_CONTRACT_VERIFIER_URL`  | Base URL of the contract verifier (without it, no verification is shown)  |
| web    | `VITE_APP_LOCAL_NETWORK`     | The `endpoints.json` contents (`network`, `networkAlias`, `representatives`); ignored in production builds |

A contract's account page then shows its code hash (marked verified when the
verifier rebuilt it), its code, the verification (source, builder, interface
and source files, or a form to submit it), its decoded state accounts and its
calls. Block pages show contract operations and the outcome of each call in
the staple.

The API's contract routes, under `/api/v1/contract`:

| Route                                       | Gives                                                                    |
|---------------------------------------------|--------------------------------------------------------------------------|
| `GET /:contract`                            | The contract's record: code hash, admin, creator, sequencer               |
| `GET /:contract/code/info`                  | The code's size and hash                                                  |
| `GET /:contract/code`                       | The code (an sBPF ELF file)                                               |
| `GET /:contract/verification`               | The verifier's result, with the interface (`null` with no verifier)      |
| `GET /:contract/verification/files/<path>`  | A file the contract was verified from                                     |
| `POST /:contract/verification`              | Submit the contract for verification (`repository`, `commit`, `package`, `manifestPath`) |
| `GET /:contract/state?startAfter&limit`     | State accounts, matched to the interface's kinds and decoded             |
| `GET /:contract/calls?startBlock&depth`     | Calls, most recent first, with decoded instructions and outcomes          |
| `GET /staple/:blockhash/calls`              | The contract calls in a block's staple, with their outcomes              |

Instruction data and state are decoded with the interface the verifier
publishes (`keeta-contract-interface/v1`, a borsh schema), by
`apps/server/src/lib/contract`.
