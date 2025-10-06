# Default target
.PHONY: all
all: dist

# This target provides a list of targets.
.PHONY: help
help:
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  all           - Builds the project"
	@echo "  dist          - Builds the project"
	@echo "  test          - Runs the test suite"
	@echo "  do-dev-server - Runs a development environment and launches an HTTP server"
	@echo "  do-lint       - Runs the linter"
	@echo "  clean         - Removes build artifacts"
	@echo "  distclean     - Removes all build artifacts and dependencies"

# 
# Test target
# 
.PHONY: test
test:
	@echo '[server] not implemented'
	@exit 0

# 
# Development server target
# 
.PHONY: do-dev-server
do-dev-server: node_modules
	APP_LOG_LEVEL=DEBUG APP_NETWORKS=test,dev,main,staging npm run tsx -- watch src/dev.ts

# 
# Lint target
# 
.PHONY: do-lint
do-lint:
	@echo '[server] not implemented'
	@exit 0

# 
# Install dependencies target
# 
node_modules/.done: Makefile package.json npm-shrinkwrap.json
	@echo "[server] Installing dependencies ..."
	rm -rf node_modules
	npm clean-install
	@touch node_modules/.done

node_modules: node_modules/.done
	@touch node_modules

# 
# Dist target
# 
dist/.done: node_modules tsconfig.json tsup.config.ts $(shell find src -type f)
	@echo "[server] Creating dist ..."
	rm -rf dist
	-@mkdir dist >/dev/null 2>/dev/null
	npm run tsup
	node -p 'const input = JSON.parse(fs.readFileSync(0, "utf-8")); delete input["scripts"]; delete input["devDependencies"]; JSON.stringify(input, undefined, 4);' < package.json > dist/server/package.json
	node -p "((s) => JSON.stringify({ ...s, packages: Object.fromEntries(Object.entries(s.packages).map(([k, v]) => [k, k === '' ? { ...v, devDependencies: undefined } : v.dev ? undefined : v]).filter(([, v]) => v !== undefined)) }, null, 4))(require('./npm-shrinkwrap.json'))" > dist/server/npm-shrinkwrap.json
	@touch dist/.done

dist: dist/.done
	@touch dist

# 
# This target cleans up the build artifacts.
# 
.PHONY: clean
clean:
	@echo "[server] Cleaning ..."
	rm -rf dist
# 	rm -rf built
	rm -rf .vite

# 
# This target removes dependencies and build artifacts.
# 
.PHONY: distclean
distclean: clean
	@echo "[server] Distcleaning ..."
	rm -rf node_modules