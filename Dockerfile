FROM node:20-alpine as build
COPY . .
RUN npm ci
RUN npx vite build

FROM nginx:1.27.2-alpine
COPY --from=build /dist /usr/share/nginx/html 

