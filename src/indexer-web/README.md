# UBB Indexer Web

This directory contains the web server and frontend interface for the UBB Indexer.

## Structure

```
indexer-web/
├── backend/          # Express server and API
│   ├── server.ts     # Main server class with REST API
│   └── types.ts      # TypeScript interfaces
├── frontend/         # Browser-side JavaScript
│   ├── app.ts        # Main application controller
│   ├── billboard-canvas.ts  # Canvas rendering logic
│   ├── state-loader.ts      # API communication
│   └── ui-helpers.ts        # Modal and UI utilities
└── templates/        # HTML and CSS
    ├── index.html    # Main page template
    └── styles.css    # All styles
```

## Deployment Options

### Option 1: Static GitHub Pages (Recommended)

Deploy as a static site on GitHub Pages. This requires no server infrastructure and automatically updates when you run the indexer.

#### Initial Setup

1. **Build the frontend:**
   ```bash
   npm run build:indexer-web
   ```

2. **Run the indexer for GitHub Pages:**
   ```bash
   npm run indexer:gh-pages -- --rpc-url http://user:pass@localhost:8332
   ```

   This will:
   - Run the indexer with data output to `docs/data/`
   - Read the tip symlink to get the current blockchain tip
   - Generate a static `config.js` with hardcoded configuration
   - Copy all static assets to `docs/`
   - The billboard becomes the main index page at `/`

3. **Commit and push:**
   ```bash
   git add docs/
   git commit -m "Deploy indexer web to GitHub Pages"
   git push
   ```

4. **Enable GitHub Pages:**
   - Go to your repository settings
   - Navigate to "Pages" section
   - Set source to "Deploy from a branch"
   - Select branch `main` and folder `/docs`
   - Save

Your site will be available at: `https://<username>.github.io/<repo>/`

The billboard viewer is at the root (`/`), and the tools page is at `/tools.html`

#### Updating the Site

To update with new blockchain data:

```bash
# Run indexer and rebuild static site
npm run indexer:gh-pages -- --rpc-url http://user:pass@localhost:8332

# Or run steps separately:
npm run indexer -- --rpc-url http://user:pass@localhost:8332 --data-dir=docs/data --network=mainnet
npm run build:indexer-web-static -- --network=mainnet
```

Then commit and push the changes in `docs/`.

#### Configuration

The GitHub Pages deployment is pre-configured for:
- **Network:** mainnet
- **Genesis Hash:** `000000000000000000010fa5bf8de1bff433e934e03ed671186592c8c3560f6e`

You need to provide your Bitcoin Core RPC URL:
```bash
npm run indexer:gh-pages -- --rpc-url http://user:pass@localhost:8332
```

### Option 2: Local Development Server

Run a local Express server for development and testing.

#### Building

The frontend TypeScript files need to be compiled to JavaScript:

```bash
npm run build:indexer-web
```

This will:
- Compile TypeScript modules to ES modules
- Bundle the frontend code
- Copy templates and CSS to the dist directory

#### Running

Start the web server:

```bash
npm run indexer-web -- --env=testnet --genesis-hash=YOUR_GENESIS_HASH --port=3000
```

Or using the compiled version:

```bash
node dist/indexer-web/backend/server.js --env=testnet --genesis-hash=YOUR_GENESIS_HASH --port=3000
```

#### API Endpoints

- `GET /` - Main web interface
- `GET /config` - Server configuration (environment, genesis hash)
- `GET /states/tip` - Redirects to current tip state
- `GET /states/:hash` - Returns state JSON for specific block hash
- `GET /images/:txid` - Returns BMP image for transaction ID

#### Development

For development, you can use `ts-node` to run directly without building:

```bash
npm run indexer-web -- --env=testnet --genesis-hash=YOUR_GENESIS_HASH
```

The server will serve the frontend from the dist directory, so make sure to run `npm run build:indexer-web` after making frontend changes.

## Architecture

### Static Mode (GitHub Pages)

In static mode, the application:
1. Loads configuration from `config.js` (generated at build time)
2. Fetches state JSON directly from `/data/{network}/v1/{genesisHash}/states/{tipHash}`
3. Loads BMP images from `/data/{network}/v1/{genesisHash}/images/{txid}.bmp`

The tip hash is hardcoded at build time by reading the `state_at_tip` symlink created by the indexer.

The billboard viewer is the main page, with tools available at `/tools.html`.

### Server Mode (Development)

In server mode, the Express server:
1. Provides `/states/tip` endpoint that redirects to current tip
2. Serves state JSON dynamically
3. Streams BMP images
4. Provides configuration via `/config` endpoint
