FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV NODE_OPTIONS=--openssl-legacy-provider
CMD ["node", "src/index.js"]
