FROM node:22-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    fontconfig \
    fonts-liberation \
    make \
    texlive-fonts-recommended \
    texlive-lang-cyrillic \
    texlive-latex-extra \
    texlive-xetex \
  && rm -rf /var/lib/apt/lists/*

COPY docker/fonts-local.conf /etc/fonts/local.conf
RUN fc-cache -f

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY app ./app
COPY templates ./templates
COPY vkr.cls setup.tex xltabular.sty ./

ENV NODE_ENV=production
ENV PORT=3000
ENV SWSU_WORKSPACE=/workspace

VOLUME ["/workspace"]
EXPOSE 3000

CMD ["npm", "start"]
