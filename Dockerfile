FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod .
COPY *.go .
RUN go build -ldflags="-s -w" -o anavai-server .

FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /root/
COPY --from=builder /app/anavai-server .
EXPOSE 3002
CMD ["./anavai-server"]
