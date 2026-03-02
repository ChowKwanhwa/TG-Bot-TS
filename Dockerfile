FROM node:20-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --include=dev
COPY prisma ./prisma
RUN npx prisma generate
RUN echo "Build successful" > success.txt
CMD ["cat", "success.txt"]
