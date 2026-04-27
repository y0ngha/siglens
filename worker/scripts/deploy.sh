#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}/.."

SERVICE_NAME="${SERVICE_NAME:-siglens-worker}"
REGION="${REGION:-asia-northeast3}"
ARTIFACT_REPOSITORY="${ARTIFACT_REPOSITORY:-siglens}"
IMAGE_NAME="${IMAGE_NAME:-siglens-worker}"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
RETAINED_IMAGE_COUNT="${RETAINED_IMAGE_COUNT:-2}"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "PROJECT_ID is not set and no active gcloud project was found." >&2
  exit 1
fi

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format="value(projectNumber)")"
BUILD_SERVICE_ACCOUNT="${BUILD_SERVICE_ACCOUNT:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"

if [[ ! -f ".env.yaml" ]]; then
  echo "worker/.env.yaml is required for Cloud Run runtime environment variables." >&2
  exit 1
fi

if [[ -z "${IMAGE_TAG:-}" ]]; then
  IMAGE_TAG="$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)"
fi

IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPOSITORY}/${IMAGE_NAME}:${IMAGE_TAG}"

SECRET_ACCESS_MEMBER="$(gcloud secrets get-iam-policy SIGLENS_GITHUB_TOKEN \
  --project "${PROJECT_ID}" \
  --flatten "bindings[].members" \
  --filter "bindings.role=roles/secretmanager.secretAccessor AND bindings.members=serviceAccount:${BUILD_SERVICE_ACCOUNT}" \
  --format "value(bindings.members)" 2>/dev/null || true)"

if [[ "${SECRET_ACCESS_MEMBER}" != "serviceAccount:${BUILD_SERVICE_ACCOUNT}" ]]; then
  cat >&2 <<EOF
Cloud Build service account cannot access SIGLENS_GITHUB_TOKEN.

Run this once:
gcloud secrets add-iam-policy-binding SIGLENS_GITHUB_TOKEN \\
  --project "${PROJECT_ID}" \\
  --member "serviceAccount:${BUILD_SERVICE_ACCOUNT}" \\
  --role "roles/secretmanager.secretAccessor"

EOF
  exit 1
fi

if ! gcloud artifacts repositories describe "${ARTIFACT_REPOSITORY}" \
  --location "${REGION}" \
  --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${ARTIFACT_REPOSITORY}" \
    --repository-format docker \
    --location "${REGION}" \
    --project "${PROJECT_ID}" \
    --description "Siglens Docker images"
fi

gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions "_IMAGE_URI=${IMAGE_URI}" \
  .

gcloud run deploy "${SERVICE_NAME}" \
  --image "${IMAGE_URI}" \
  --region "${REGION}" \
  --timeout 3600 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --allow-unauthenticated \
  --env-vars-file .env.yaml

if [[ "${RETAINED_IMAGE_COUNT}" =~ ^[0-9]+$ ]] && [[ "${RETAINED_IMAGE_COUNT}" -gt 0 ]]; then
  IMAGE_VERSIONS=()
  while IFS= read -r line; do
    [[ -n "${line}" ]] && IMAGE_VERSIONS+=("${line}")
  done < <(
    gcloud artifacts versions list \
      --repository "${ARTIFACT_REPOSITORY}" \
      --location "${REGION}" \
      --project "${PROJECT_ID}" \
      --package "${IMAGE_NAME}" \
      --sort-by "~update_time" \
      --format "value(name)" 2>/dev/null || true
  )

  for ((index = RETAINED_IMAGE_COUNT; index < ${#IMAGE_VERSIONS[@]}; index++)); do
    gcloud artifacts versions delete "${IMAGE_VERSIONS[$index]}" \
      --delete-tags \
      --quiet
  done
fi
