ARG NODE_IMAGE=us-central1-docker.pkg.dev/mimetic-algebra-344104/keeta/nodejs-base-24@sha256:d3be1edd8c0de70fb9d621a2494c7cc58e0ebbeeae64a54d666773510feb1d34
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
FROM gcr.io/distroless/nodejs24-debian12 AS server-runner

# Create app directory
WORKDIR /app

# Copy the built application from the builder stage
COPY --from=server-builder /app /app

# Set port
EXPOSE 8080
ENV APP_LISTEN_PORT 8080

# Start the application
CMD [ "main.cjs" ]
