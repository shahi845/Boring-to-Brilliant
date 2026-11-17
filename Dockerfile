# Production image: builds the front end, then serves it together with the API.
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY --from=build /app/dist ./dist
COPY server ./server
COPY package.json ./
USER node
EXPOSE 8787
HEALTHCHECK CMD wget -qO- http://localhost:8787/api/health || exit 1
CMD ["node", "server/index.js"]
