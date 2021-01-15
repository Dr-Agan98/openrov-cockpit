FROM ubuntu:18.04

RUN \
 apt-get update && \
 apt-get install -y make && \
 apt-get install -y git && \
 apt-get install -y g++ && \
 apt-get install -y gcc && \
 apt-get install -y ffmpeg && \
 apt-get install -y python && \
 apt-get install -y cmake libjpeg8-dev && \
 git clone https://github.com/jacksonliam/mjpg-streamer.git && \
 cd mjpg-streamer/mjpg-streamer-experimental && \
 make && \
 make install && \
 apt-get install -y ca-certificates wget && \
 update-ca-certificates && \
 wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.37.2/install.sh | bash

WORKDIR /project

RUN \
 export NVM_DIR="$HOME/.nvm" && \
 [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
 [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion" && \
 nvm install 6.17.1 && \
 npm install -g yarn && \
 ln -s /root/.nvm/versions/node/v6.17.1/bin/yarn /usr/local/bin/yarn && \
 git clone https://github.com/Dr-Agan98/openrov-cockpit.git && \
 cd openrov-cockpit && \
 npm run deploy:prod

WORKDIR /project/openrov-cockpit

ENTRYPOINT ["./start-openrov.sh"]