FROM node:22-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN sed -i 's/Components: main/Components: main contrib non-free non-free-firmware/' /etc/apt/sources.list.d/debian.sources \
  && echo "ttf-mscorefonts-installer msttcorefonts/accepted-mscorefonts-eula select true" | debconf-set-selections \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    cabextract \
    ca-certificates \
    fontconfig \
    fonts-liberation \
    make \
    texlive-fonts-recommended \
    texlive-lang-cyrillic \
    texlive-latex-extra \
    texlive-xetex \
    ttf-mscorefonts-installer \
  && rm -rf /var/lib/apt/lists/*

COPY docker/fonts-local.conf /etc/fonts/local.conf
RUN fc-cache -f

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY app ./app
COPY templates ./templates
COPY vkr.cls setup.tex xltabular.sty ./
COPY vite.config.mjs ./
RUN npm run build \
  && npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000
ENV SWSU_WORKSPACE=/workspace

VOLUME ["/workspace"]
EXPOSE 3000

CMD ["npm", "start"]
