ARG NODE_IMAGE=us-central1-docker.pkg.dev/mimetic-algebra-344104/keeta/nodejs-base-20@sha256:77c6a086e53d1a81e1d58bc9679ed2426e9badd0fb79fdd1a61455f0f40b8b4a
FROM ${NODE_IMAGE} AS base

#
# Builder stage
#
FROM ${NODE_IMAGE} AS server-builder

# Create app directory
WORKDIR /app

# Copy files from server
COPY ./server.zip /app/server.zip

# Unzip the server application
RUN unzip -o server.zip -d /app && \
	rm server.zip

#
# Runner stage
#
FROM gcr.io/distroless/nodejs20-debian12 AS server-runner

# Create app directory
WORKDIR /app

# Copy the built application from the builder stage
COPY --from=server-builder /app /app

# Set port
EXPOSE 8080
ENV APP_LISTEN_PORT 8080

# Start the application
CMD [ "main.cjs" ]
