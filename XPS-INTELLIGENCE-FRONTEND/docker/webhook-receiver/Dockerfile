FROM node:20-alpine

WORKDIR /receiver

COPY package.json ./
RUN npm install --omit=dev

COPY index.js ./

# Create a non-root user for security
RUN addgroup -S webhook && adduser -S webhook -G webhook
USER webhook

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:3001/health || exit 1

CMD ["node", "index.js"]
