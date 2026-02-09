# Use Node LTS image
FROM node:20

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy all source code (including src/, tsconfig.json, etc.)
COPY . .

# Build the TypeScript (compiles src/ to dist/)
RUN npm run build

# Run the server (from dist/index.js)
CMD [ "node", "dist/index.js" ]
