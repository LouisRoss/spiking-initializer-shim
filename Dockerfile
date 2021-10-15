FROM node:15.14

LABEL version="1.0"
LABEL description="This is the Spiking Neural Network engine initializer shim.  It accepts raw socket requests from the engine and forwards them as API calls to the packager."
LABEL maintainer = "Louis Ross <louis.ross@gmail.com"

WORKDIR /app

COPY ["package.json", "package-lock.json", "./"]
RUN ls
#RUN npm install --production
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
