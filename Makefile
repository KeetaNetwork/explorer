WORKSPACES := apps/server apps/web apps/cloud

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
	@echo "  do-dev-server - Runs a development environment and launches an HTTP server"
	@echo "  do-lint       - Runs linting on the project"
	@echo "  do-set-version - Sets the version of the project"
	@echo "  do-deploy-dev - Deploys the project to a development environment"
	@echo "  do-publish    - Publishes the project to npm"
	@echo "  clean         - Removes build artifacts"
	@echo "  distclean     - Removes all build artifacts and dependencies"

#
# Test target
#
.PHONY: test
test:
	@echo '[root] not implemented'
	@exit 0

#
# Development server target
#
.PHONY: do-dev-server
do-dev-server: node_modules
	npm run tsx -- scripts/start-dev-server.ts

#
# Lint target
#
.PHONY: do-lint
do-lint:
	@echo '[root] not implemented'
	@exit 0
# @for dir in $(WORKSPACES); do \
# 	$(MAKE) -C $$dir do-lint; \
# done


#
# Install dependencies target
#
apps/cloud/dist/keetanetwork-explorer-cloud.tgz: $(shell find apps -type d \( -name dist -o -name node_modules \) -prune -o -type f)
	make -C apps/cloud dist

node_modules/.done: Makefile package.json npm-shrinkwrap.json apps/cloud/dist/keetanetwork-explorer-cloud.tgz
	@echo "[root] Installing dependencies ..."
	rm -rf node_modules
	npm clean-install
	@touch node_modules/.done

node_modules: node_modules/.done
	@touch node_modules

#
# Deployment target
#
.PHONY: do-deploy-dev
do-deploy-dev: node_modules dist
	cd deployment && pulumi up -s dev -y

#
# Publish package target
#
.PHONY: do-publish
do-publish: dist
	npm publish ./dist/keetanetwork-explorer-cloud.tgz

#
# Dist target
#
dist/.done: node_modules
	rm -rf dist
	-@mkdir -p dist >/dev/null 2>/dev/null
	@echo "[root] Building the project ..."
	cp apps/cloud/dist/keetanetwork-explorer-cloud.tgz dist/
	@touch dist/.done

dist: dist/.done
	@touch dist

#
# This target cleans up the build artifacts.
#
.PHONY: clean
clean:
	rm -rf dist
	rm -rf built
	@for dir in $(WORKSPACES); do \
		echo "\nCleaning $$dir"; \
		$(MAKE) -C $$dir clean; \
	done

#
# This target removes dependencies and build artifacts.
#
.PHONY: distclean
distclean: clean
	rm -rf node_modules
	@for dir in $(WORKSPACES); do \
		echo "\nDistcleaning $$dir"; \
		$(MAKE) -C $$dir distclean; \
	done
