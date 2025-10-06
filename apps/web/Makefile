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
	@echo 'not implemented'
	@exit 0

#
# Development server target
#
.PHONY: do-dev-server
do-dev-server: node_modules
	npm run vite -- --host 0.0.0.0 -l info

#
# Lint target
#
.PHONY: do-lint
do-lint:
	@echo 'not implemented'
	@exit 0

#
# Install dependencies target
#
.PHONY: build-deps
build-deps:
	make -C ../server dist

node_modules/.done: Makefile package.json npm-shrinkwrap.json build-deps
	@echo "[web] Installing dependencies ..."
	rm -rf node_modules
	npm clean-install
	@touch node_modules/.done

node_modules: node_modules/.done
	@touch node_modules

#
# Dist target
#
dist/.done: node_modules tsconfig.json vite.config.ts index.html $(shell find src -type f) $(shell find public -type f)
	rm -rf dist
	-@mkdir dist >/dev/null 2>/dev/null
	npm run vite -- build --outDir ./dist
	@touch dist/.done

dist: dist/.done
	@touch dist

#
# This target cleans up the build artifacts.
#
.PHONY: clean
clean:
	@echo "[web] Cleaning ..."
	rm -rf dist
	rm -rf .vite

#
# This target removes dependencies and build artifacts.
#
.PHONY: distclean
distclean: clean
	@echo "[web] Distcleaning ..."
	rm -rf node_modules
	rm -rf vendor
