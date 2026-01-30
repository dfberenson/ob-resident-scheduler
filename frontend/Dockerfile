FROM node:20-alpine

WORKDIR /app

COPY frontend/package.json /app/package.json
COPY frontend/tsconfig.json /app/tsconfig.json
COPY frontend/next-env.d.ts /app/next-env.d.ts
COPY frontend/next.config.mjs /app/next.config.mjs
RUN npm install

COPY frontend/app /app/app

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0"]
