FROM node:26-alpine as build
COPY . .
RUN npm ci
RUN npx vite build

FROM nginx:1.31.6-alpine
COPY --from=build /dist /usr/share/nginx/html 

