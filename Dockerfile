# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies first for better caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY src ./src
COPY public ./public
COPY data ./data
RUN npm run build

# Production stage
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy only production dependencies and built output
COPY package.json package-lock.json ./
RUN npm ci --production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/views ./src/views
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

ENV NODE_ENV=production
ENV PORT=8989
EXPOSE 8989
CMD ["npm", "start"]
