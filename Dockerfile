FROM node:24-alpine
RUN apk add --no-cache tzdata
WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN npm ci

COPY . .
CMD ["node", "index.js"]
