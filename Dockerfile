FROM node:22-alpine as build
COPY . .
RUN npm ci
RUN npx vite build

FROM nginx:1.29.0-alpine
COPY --from=build /dist /usr/share/nginx/html 

