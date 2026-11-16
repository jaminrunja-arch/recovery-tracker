FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir /data && chown node:node /data
ENV DATA_DIR=/data
ENV PORT=3000
USER node
EXPOSE 3000
CMD ["node", "server.js"]
