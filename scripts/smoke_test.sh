#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"

echo "Checking backend health..."
curl -fsS "${API_BASE_URL}/health" >/dev/null

echo "Checking seeded periods..."
periods_json="$(curl -fsS "${API_BASE_URL}/periods")"
period_id="$(printf "%s" "${periods_json}" | python - <<'PY'
import json, sys
data = json.load(sys.stdin)
print(data[0]["id"] if data else "")
PY
)"
if [ -z "${period_id}" ]; then
  echo "No periods found. Auto-seed may have failed."
  exit 1
fi
echo "Found period ID ${period_id}"

echo "Checking residents..."
curl -fsS "${API_BASE_URL}/residents" >/dev/null

echo "Starting async generation job..."
job_json="$(curl -fsS -X POST "${API_BASE_URL}/schedule-periods/${period_id}/generate")"
job_id="$(printf "%s" "${job_json}" | python - <<'PY'
import json, sys
print(json.load(sys.stdin).get("job_id", ""))
PY
)"
if [ -z "${job_id}" ]; then
  echo "No job_id returned from generation endpoint."
  exit 1
fi
echo "Job ID: ${job_id}"

echo "Polling job status..."
for _ in {1..30}; do
  status_json="$(curl -fsS "${API_BASE_URL}/jobs/${job_id}")"
  status="$(printf "%s" "${status_json}" | python - <<'PY'
import json, sys
print(json.load(sys.stdin).get("status", ""))
PY
)"
  if [ "${status}" = "SUCCESS" ]; then
    version_id="$(printf "%s" "${status_json}" | python - <<'PY'
import json, sys
payload = json.load(sys.stdin)
print(payload.get("result", {}).get("version_id", ""))
PY
)"
    echo "Job succeeded with version ${version_id}"
    break
  fi
  if [ "${status}" = "FAILURE" ]; then
    echo "Job failed."
    exit 1
  fi
  sleep 1
done

if [ -z "${version_id:-}" ]; then
  echo "Job did not complete within timeout."
  exit 1
fi

echo "Validating version..."
curl -fsS "${API_BASE_URL}/schedule-versions/${version_id}/validate" >/dev/null

echo "Publishing version..."
curl -fsS -X POST "${API_BASE_URL}/schedule-versions/${version_id}/publish" >/dev/null

echo "Smoke test completed successfully."
