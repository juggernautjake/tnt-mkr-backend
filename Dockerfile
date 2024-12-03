FROM node:20.18.0-bullseye

# Install dependencies for sharp compatibility
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    make \
    zlib1g-dev \
    libvips-dev \
    python3 \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for sharp
ENV NODE_ENV=production

WORKDIR /opt/app

# Copy package files and install dependencies
COPY package.json yarn.lock ./
RUN yarn install

# Copy application files
COPY . .

# Set permissions for non-root user
RUN chown -R node:node /opt/app
USER node

# Build the Strapi admin panel
RUN yarn build

# Expose the application port
EXPOSE 1337

# Start the application
CMD ["yarn", "start"]
