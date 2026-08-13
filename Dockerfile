FROM node:22-alpine
WORKDIR /app

COPY rcrt-sdk-0.1.1.tgz .
COPY package.json .
RUN npm install --omit=dev

COPY src/ src/
COPY public/ public/

EXPOSE 8080
CMD ["node", "src/server.js"]
