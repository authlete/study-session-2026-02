FROM mcr.microsoft.com/devcontainers/typescript-node:24-bookworm

# Install ngrok via the official apt repository
RUN curl -sSL https://ngrok-agent.s3.amazonaws.com/ngrok.asc \
  | tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null \
  && echo "deb https://ngrok-agent.s3.amazonaws.com bookworm main" \
  | tee /etc/apt/sources.list.d/ngrok.list \
  && apt update \
  && apt install -y ngrok \
  && apt clean \
  && rm -rf /var/lib/apt/lists/*
