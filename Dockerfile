FROM node:22-alpine
WORKDIR /app

# Copy the SDK tgz + package.json first so npm can install from the local file
COPY rcrt-sdk-0.1.1.tgz .
COPY package.json .
RUN npm install --omit=dev

# Copy the server
COPY server.js .

EXPOSE 8080
CMD ["node", "server.js"]