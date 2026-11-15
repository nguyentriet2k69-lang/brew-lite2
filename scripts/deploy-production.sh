#!/usr/bin/env bash
# RETIRED: legacy Ubuntu/Compose deployment; active production uses Vercel + Render.
set -Eeuo pipefail

cd "$(dirname "$0")"

: "${RELEASE_SHA:?Set RELEASE_SHA to the release commit SHA}"

read_env_value() {
  local key="$1"
  local line
  if ! line=$(grep -m1 "^${key}=" .env); then
    printf '[deploy] %s is missing from the production .env file.\n' "$key" >&2
    return 1
  fi
  printf '%s' "${line#*=}"
}

WEB_DOMAIN="${WEB_DOMAIN:-$(read_env_value WEB_DOMAIN)}"
API_DOMAIN="${API_DOMAIN:-$(read_env_value API_DOMAIN)}"
domain_regex='^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$'

if [[ ! "$RELEASE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  printf '[deploy] RELEASE_SHA must be a 40-character lowercase commit SHA.\n' >&2
  exit 2
fi
if [[ ! "$WEB_DOMAIN" =~ $domain_regex || ! "$API_DOMAIN" =~ $domain_regex ]]; then
  printf '[deploy] WEB_DOMAIN and API_DOMAIN must be valid public DNS hostnames.\n' >&2
  exit 2
fi

compose=(docker compose --env-file .env -f docker-compose.prod.yml)
previous_sha=''
if [[ -s .release-sha ]]; then
  previous_sha=$(<.release-sha)
  if [[ ! "$previous_sha" =~ ^[0-9a-f]{40}$ ]]; then
    printf '[deploy] The recorded previous release is not a valid commit SHA.\n' >&2
    exit 2
  fi
fi
release_activated=0

on_error() {
  local exit_code=$?
  trap - ERR
  if (( release_activated )); then
    if [[ -n "$previous_sha" ]]; then
      printf '[deploy] Release failed; restoring application image %s.\n' "$previous_sha" >&2
      if ! RELEASE_SHA="$previous_sha" "${compose[@]}" up -d --wait --wait-timeout 180 api web proxy; then
        printf '[deploy] Previous images could not be restored; investigate Compose logs.\n' >&2
      elif ! curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 2 "https://${WEB_DOMAIN}/" > /dev/null \
        || ! curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 2 "https://${API_DOMAIN}/health" > /dev/null \
        || ! curl --fail --silent --show-error --retry 5 --retry-connrefused --retry-delay 2 "https://${API_DOMAIN}/products" > /dev/null; then
        printf '[deploy] Previous images were restored, but the rollback smoke check failed.\n' >&2
      fi
    else
      printf '[deploy] First release failed; stopping the new application services.\n' >&2
      "${compose[@]}" stop api web proxy || true
    fi
  else
    printf '[deploy] Release stopped before application rollout; the running release was left unchanged.\n' >&2
  fi
  exit "$exit_code"
}
trap on_error ERR

printf '[deploy] Starting PostgreSQL and waiting for health.\n'
"${compose[@]}" up -d --wait --wait-timeout 120 db

install -d -m 700 backups
umask 077
printf '[deploy] Pulling release images and backing up the database before migration.\n'
"${compose[@]}" pull api web
backup_file="backups/pre-migration-${RELEASE_SHA}-$(date -u +%Y%m%dT%H%M%SZ).dump"
"${compose[@]}" exec -T db sh -c 'pg_dump --format=custom --no-owner --no-acl --username="$POSTGRES_USER" "$POSTGRES_DB"' > "$backup_file"
if [[ ! -s "$backup_file" ]]; then
  printf '[deploy] Database dump is empty; refusing to continue.\n' >&2
  exit 1
fi

printf '[deploy] Applying migrations from the release image.\n'
RELEASE_SHA="$RELEASE_SHA" "${compose[@]}" run --rm --no-deps migrate

if [[ ! -e .seed-complete ]]; then
  printf '[deploy] Initializing demo products.\n'
  RELEASE_SHA="$RELEASE_SHA" "${compose[@]}" run --rm --no-deps seed
  touch .seed-complete
fi

release_activated=1
printf '[deploy] Starting API, web, and HTTPS proxy.\n'
RELEASE_SHA="$RELEASE_SHA" "${compose[@]}" up -d --wait --wait-timeout 180 api web proxy

printf '[deploy] Running HTTPS smoke checks.\n'
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 2 "https://${WEB_DOMAIN}/" > /dev/null
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 2 "https://${API_DOMAIN}/health" > /dev/null
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 2 "https://${API_DOMAIN}/products" > /dev/null

if [[ -n "$previous_sha" ]]; then
  printf '%s\n' "$previous_sha" > .previous-release-sha.tmp
  mv .previous-release-sha.tmp .previous-release-sha
fi
printf '%s\n' "$RELEASE_SHA" > .release-sha.tmp
mv .release-sha.tmp .release-sha
printf '[deploy] Release %s is healthy.\n' "$RELEASE_SHA"
