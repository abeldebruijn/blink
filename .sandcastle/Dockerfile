FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Build-args for UID/GID alignment: sandcastle docker build-image
# defaults these to the host user's UID/GID so image-built files
# and bind-mounted files share an owner without runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Rename the base image's "node" user to "agent" and align UID/GID.
# macOS commonly uses GID 20, which already exists in Debian base images.
RUN set -eux; \
  existing_group="$(getent group "$AGENT_GID" | cut -d: -f1 || true)"; \
  if [ -z "$existing_group" ]; then \
    groupmod -g "$AGENT_GID" node; \
    existing_group=node; \
  fi; \
  usermod -u "$AGENT_UID" -g "$AGENT_GID" -d /home/agent -m -l agent node; \
  chown -R "$AGENT_UID:$AGENT_GID" /home/agent

# Install Codex CLI (run as root before USER agent)
RUN npm install -g @openai/codex pnpm \
  && mv /usr/local/bin/codex /usr/local/bin/codex-real \
  && printf '%s\n' \
    '#!/bin/sh' \
    'set -eu' \
    'api_key="${OPENAI_API_KEY:-${OPENAI_KEY:-}}"' \
    'if [ -n "$api_key" ] && [ ! -f "${HOME:-/home/agent}/.codex/auth.json" ]; then' \
    '  mkdir -p "${HOME:-/home/agent}/.codex"' \
    '  printf "%s" "$api_key" | codex-real login --with-api-key >/dev/null 2>&1 || true' \
    'fi' \
    'exec codex-real "$@"' \
    > /usr/local/bin/codex \
  && chmod +x /usr/local/bin/codex

USER ${AGENT_UID}:${AGENT_GID}

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
