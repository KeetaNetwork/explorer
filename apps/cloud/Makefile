all: dist

#
# Test target
#
.PHONY: test
test:
	@echo '[cloud] not implemented'
	@exit 0

#
# Lint target
#
do-lint:
	@echo "[cloud] not implemented"
	@exit 0

#
# Install dependencies target
#
node_modules/.done: package.json npm-shrinkwrap.json
	@echo "[cloud] Installing dependencies ..."
	rm -rf node_modules
	npm clean-install
	@touch node_modules/.done

node_modules: node_modules/.done
	@touch node_modules

#
# Dist target
#
dist/web/.done: $(shell find ../web -type d \( -name dist -o -name node_modules \) -prune -o -type f)
	@echo "[cloud] Copying web to dist ..."
	rm -rf dist/web
	-@mkdir -p dist/web >/dev/null 2>/dev/null
	make -C ../web dist
	cp -r ../web/dist/* dist/web/
	@touch dist/web/.done

dist/web: dist/web/.done
	@touch dist/web

dist/server/.done: $(shell find ../server -type d \( -name dist -o -name node_modules \) -prune -o -type f)
	@echo "[cloud] Copying server to dist ..."
	rm -rf dist/server
	-@mkdir -p dist/server >/dev/null 2>/dev/null
	@make -C ../server dist
	cp -r ../server/dist/server/* dist/server/
	cd dist/server && npm ci --omit=dev
	cd dist/server && zip -rq ../server.zip *
	@touch dist/server/.done

dist/server: dist/server/.done
	@touch dist/server

dist/cloud/.done: node_modules tsconfig.json tsup.config.ts $(shell find src -type f -name '*.ts')
	@echo "[cloud] Creating dist ..."
	rm -rf dist/cloud
	-@mkdir -p dist >/dev/null 2>/dev/null
	npm run tsup -- --outDir dist/cloud
	node -p 'const input = JSON.parse(fs.readFileSync(0, "utf-8")); const rootPkg = JSON.parse(fs.readFileSync("../../package.json", "utf-8")); input.version = rootPkg.version; delete input["scripts"]; delete input["devDependencies"]; delete input["private"]; JSON.stringify(input, undefined, 4);' < package.json > dist/package.json
	node -p "((s) => JSON.stringify({ ...s, packages: Object.fromEntries(Object.entries(s.packages).map(([k, v]) => [k, k === '' ? { ...v, devDependencies: undefined } : v.dev ? undefined : v]).filter(([, v]) => v !== undefined)) }, null, 4))(require('./npm-shrinkwrap.json'))" > dist/npm-shrinkwrap.json
	@touch dist/cloud/.done

dist/cloud: dist/cloud/.done
	@touch dist/cloud


dist/.done: dist/web dist/server dist/cloud src/docker/Dockerfile
	@echo "[cloud] Dist is ready."
	-rm dist/keetanetwork-explorer-*.tgz
	-rm dist/Dockerfile
	cp src/docker/Dockerfile dist/Dockerfile
	cd dist && npm pack && mv keetanetwork-explorer-*.tgz keetanetwork-explorer-cloud.tgz
	@touch dist/.done

dist: dist/.done
	@touch dist

#
# This target cleans up the build artifacts.
#
.PHONY: clean
clean:
	@echo "[cloud] Cleaning ..."
	rm -rf dist

#
# This target removes dependencies and build artifacts.
#
.PHONY: distclean
distclean: clean
	@echo "[cloud] Distcleaning ..."
	rm -rf node_modules
