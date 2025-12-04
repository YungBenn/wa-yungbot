# wa-yungbenn

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.2.22. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Docker

### Building the Docker Image

Build the Docker image:

```bash
docker build -t wa-yungbot .
```

This will build the image using the multi-stage Dockerfile with Bun.

### Running the Container

#### Basic Run (Detached Mode)

Run the container in detached mode:

```bash
docker run -d \
  --name wa-yungbot \
  -v wa-yungbot-auth:/usr/src/app/.wwebjs_auth \
  -v wa-yungbot-backups:/usr/src/app/backups \
  wa-yungbot
```

#### Interactive Mode (For QR Code Scanning)

If you need to scan the QR code on first run, use interactive mode:

```bash
docker run -it --rm \
  --name wa-yungbot \
  -v wa-yungbot-auth:/usr/src/app/.wwebjs_auth \
  -v wa-yungbot-backups:/usr/src/app/backups \
  wa-yungbot
```

#### Using Host Directories (Optional)

To map to local directories instead of Docker volumes:

```bash
docker run -d \
  --name wa-yungbot \
  -v $(pwd)/.wwebjs_auth:/usr/src/app/.wwebjs_auth \
  -v $(pwd)/backups:/usr/src/app/backups \
  wa-yungbot
```

### Managing the Container

View logs:

```bash
docker logs -f wa-yungbot
```

Stop the container:

```bash
docker stop wa-yungbot
```

Remove the container:

```bash
docker rm wa-yungbot
```

### Important Notes

1. **Volumes**: The container uses volumes to persist:

   - `.wwebjs_auth` - WhatsApp session/auth data (persists login)
   - `backups` - Backup data directory

2. **QR Code**: On first run, you'll need to scan the QR code. Use interactive mode (`-it`) to see it in the terminal.

3. The Dockerfile runs `bun run index.ts` as the `bun` user in production mode.
