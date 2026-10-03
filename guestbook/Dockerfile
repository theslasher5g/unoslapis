FROM node:22-alpine
WORKDIR /app
COPY server.js casino.js duel.js poker.js jeopardy.js jeopardy-data.js ./
RUN mkdir -p /data && chown node:node /data
USER node
ENV DATA_FILE=/data/entries.json PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
