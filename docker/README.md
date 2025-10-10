# Docker image for UMEditor (Alpine + Nginx + PHP-FPM)

This folder contains a lightweight Docker setup using Alpine, Nginx and PHP-FPM for the PHP version of the project, plus a GitHub Actions workflow to build and push the image to GitHub Container Registry (GHCR).

Files:
- `Dockerfile` - image based on `alpine` with `nginx` and `php8-fpm`.
- `nginx.conf` - minimal nginx configuration routing .php to php-fpm.
- `supervisord.conf` - runs `php-fpm` and `nginx` under supervisord.
- `docker-entrypoint.sh` - entrypoint script.

Local build and run:

```powershell
# Build
docker build -t umeditor:local .\docker\php-nginx-alpine

# Run (map host port 8080)
docker run --rm -p 8080:80 umeditor:local

# Then open http://localhost:8080
```

Publishing via GitHub Actions to GHCR:

1. The workflow `.github/workflows/docker-publish.yml` will build and push the image to `ghcr.io/<OWNER>/umeditor` on push to `master` or when manually triggered.
2. By default the workflow uses `secrets.GITHUB_TOKEN` to authenticate and requires the workflow to have `packages: write` permission (configured in the workflow). To let the workflow publish packages for an organization or to use a PAT, set `secrets.GHCR_PAT` and update the workflow to use it.

Notes:
- The image exposes port 80.
- The build produces `latest` and a commit-sha tagged image.
- If you need additional PHP extensions, add them to the `Dockerfile` and rebuild.
