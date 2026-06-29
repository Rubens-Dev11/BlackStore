FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN chmod +x docker-entrypoint.sh
EXPOSE 3001
ENTRYPOINT ["sh", "./docker-entrypoint.sh"]
CMD ["npm", "run", "dev", "--", "--port", "3001", "--hostname", "0.0.0.0"]
