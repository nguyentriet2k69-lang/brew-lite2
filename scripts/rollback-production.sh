#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"

if [[ ! -s .previous-release-sha ]]; then
  printf '[rollback] No previous successful release is recorded.\n' >&2
  exit 1
fi

release_sha=$(<.previous-release-sha)
printf '[rollback] Redeploying application image %s.\n' "$release_sha"
RELEASE_SHA="$release_sha" bash ./deploy-production.sh
