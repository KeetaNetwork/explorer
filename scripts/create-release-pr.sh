#!/usr/bin/env bash
#
# Opens (or refreshes) the release pull request for the next patch version:
#
#   1. bumps "version" in package.json and npm-shrinkwrap.json
#   2. commits "Release v<version>" on process/v<version> and force pushes it
#   3. opens the "Release v<version>" pull request, or updates the open one
#
# Merging that pull request changes the version on main, and
# .github/workflows/publish-and-release.yml then publishes the package, tags
# releases/v<version> and creates the GitHub release.
#
# Used by `make do-release-pr`.
#
# Usage: create-release-pr.sh [--dry-run]
#
#   --dry-run  print the version and the description without changing anything
#
# Environment:
#   RELEASE_BASE_BRANCH  base branch (default: main)
#

set -euo pipefail

BASE_BRANCH="${RELEASE_BASE_BRANCH:-main}"
DRY_RUN="false"

while [ $# -gt 0 ]; do
	case "$1" in
		--dry-run)
			DRY_RUN="true"
			;;
		*)
			echo "error: unknown argument '$1'" >&2
			echo "usage: create-release-pr.sh [--dry-run]" >&2
			exit 1
			;;
	esac
	shift
done

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v gh > /dev/null 2>&1; then
	echo "error: the GitHub CLI (gh) is required, see https://cli.github.com" >&2
	exit 1
fi

if [ "$DRY_RUN" = "false" ]; then
	if [ "$(git rev-parse --abbrev-ref HEAD)" != "$BASE_BRANCH" ]; then
		echo "error: run this from '$BASE_BRANCH'" >&2
		exit 1
	fi

	if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
		echo "error: working directory has uncommitted changes" >&2
		exit 1
	fi

	git fetch --tags origin "$BASE_BRANCH"
	git merge --ff-only "origin/$BASE_BRANCH"
fi

CURRENT_VERSION="$(jq -r .version package.json)"
if ! [[ "$CURRENT_VERSION" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
	echo "error: '$CURRENT_VERSION' in package.json is not a plain major.minor.patch version" >&2
	exit 1
fi
NEXT_VERSION="${BASH_REMATCH[1]}.${BASH_REMATCH[2]}.$((BASH_REMATCH[3] + 1))"

BRANCH="process/v$NEXT_VERSION"
TITLE="Release v$NEXT_VERSION"
TAG="releases/v$NEXT_VERSION"
REPOSITORY="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

# The same notes the GitHub release will start from, as a preview.
NOTES_ARGS=(-f tag_name="$TAG" -f target_commitish="$BASE_BRANCH")
if PREVIOUS_TAG="$(git describe --tags --abbrev=0 --match 'releases/v*' HEAD 2> /dev/null)"; then
	NOTES_ARGS+=(-f previous_tag_name="$PREVIOUS_TAG")
fi
BODY="$(gh api -X POST "repos/$REPOSITORY/releases/generate-notes" "${NOTES_ARGS[@]}" --jq .body)"

if [ "$DRY_RUN" = "true" ]; then
	echo "Title:  $TITLE"
	echo "Branch: $BRANCH"
	echo "Description:"
	echo "$BODY"
	echo "Dry run, nothing was committed, pushed or opened"
	exit 0
fi

git checkout -B "$BRANCH"
npm version "$NEXT_VERSION" --no-git-tag-version --ignore-scripts > /dev/null
git commit -m "$TITLE" -- package.json npm-shrinkwrap.json
git push --force origin "HEAD:refs/heads/$BRANCH"

EXISTING="$(gh pr list --head "$BRANCH" --base "$BASE_BRANCH" --state open --json number --jq '.[0].number')"
if [ -n "$EXISTING" ]; then
	gh pr edit "$EXISTING" --title "$TITLE" --body "$BODY"
else
	gh pr create --base "$BASE_BRANCH" --head "$BRANCH" --title "$TITLE" --body "$BODY"
fi

git checkout "$BASE_BRANCH"
