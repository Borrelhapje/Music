FROM node:24-alpine as build
COPY . .
RUN npm ci
RUN npx vite build

FROM nginx:1.29.3-alpine
COPY --from=build /dist /usr/share/nginx/html 

