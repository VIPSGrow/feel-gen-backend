# Node version select karein
FROM node:20

# canvas ko source se build karne ke liye system libraries (prebuilt download fail ho to fallback)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config python3 \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Working directory set karein
WORKDIR /app

# Dependencies copy aur install karein
COPY package*.json ./
RUN npm install

# Baaki saara code copy karein
COPY . .

# Port expose karein (jo aapne env mein 5000 rakha hai)
EXPOSE 5000

# App start karein
CMD ["npm", "start"]