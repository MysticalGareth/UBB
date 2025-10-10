import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { WebServerConfig, StateData } from './types.js';

export class IndexerWebServer {
  private app: express.Application;
  private config: WebServerConfig;
  private dataPath: string;

  constructor(config: WebServerConfig) {
    this.app = express();
    this.config = config;
    // New structure: data/{network}/v1/{genesisHash}/
    this.dataPath = path.join(process.cwd(), 'data', config.environment, 'v1', config.genesisHash);
    
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Serve static files (frontend JS, CSS)
    // When running with ts-node, __dirname is src/indexer-web/backend
    // When running compiled, __dirname is dist/indexer-web/backend
    const isCompiled = __dirname.includes('dist');
    const templatesPath = isCompiled 
      ? path.join(__dirname, '../templates')
      : path.join(process.cwd(), 'dist/indexer-web/templates');
    const frontendPath = isCompiled
      ? path.join(__dirname, '../frontend')
      : path.join(process.cwd(), 'dist/indexer-web/frontend');
    
    this.app.use('/static', express.static(templatesPath));
    this.app.use('/frontend', express.static(frontendPath));

    // GET /states/tip - redirects to the current tip state
    this.app.get('/states/tip', (req: Request, res: Response) => {
      try {
        // No cache headers for dynamic tip
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        const symlinkPath = path.join(this.dataPath, 'state_at_tip');
        
        // Check if symlink exists
        if (!fs.existsSync(symlinkPath)) {
          return res.status(404).json({ error: 'No tip state found' });
        }

        // Read the symlink to get the target
        const target = fs.readlinkSync(symlinkPath);
        
        // Extract the hash from the target path (e.g., "states/4ac40d5b...")
        const hash = path.basename(target);
        
        // Send 302 temporary redirect (not 301 permanent which gets cached)
        res.redirect(302, `/states/${hash}`);
      } catch (error) {
        console.error('Error reading tip state:', error);
        res.status(500).json({ error: 'Failed to read tip state' });
      }
    });

    // GET /states/:hash - returns the state JSON
    this.app.get('/states/:hash', (req: Request, res: Response) => {
      try {
        // No cache for state data to always get fresh data
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        
        const { hash } = req.params;
        const statePath = path.join(this.dataPath, 'states', hash);
        
        if (!fs.existsSync(statePath)) {
          return res.status(404).json({ error: 'State not found' });
        }

        const stateData = fs.readFileSync(statePath, 'utf-8');
        const state: StateData = JSON.parse(stateData);
        
        res.json(state);
      } catch (error) {
        console.error('Error reading state:', error);
        res.status(500).json({ error: 'Failed to read state' });
      }
    });

    // GET /images/:txid - returns the BMP image
    this.app.get('/images/:txid', (req: Request, res: Response) => {
      try {
        const { txid } = req.params;
        const imagePath = path.join(this.dataPath, 'images', `${txid}.bmp`);
        
        if (!fs.existsSync(imagePath)) {
          return res.status(404).json({ error: 'Image not found' });
        }

        // Set appropriate headers for BMP
        res.setHeader('Content-Type', 'image/bmp');
        
        // Stream the file
        const imageStream = fs.createReadStream(imagePath);
        imageStream.pipe(res);
      } catch (error) {
        console.error('Error reading image:', error);
        res.status(500).json({ error: 'Failed to read image' });
      }
    });

    // GET /config - returns the server configuration
    this.app.get('/config', (req: Request, res: Response) => {
      // No cache for config
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json({
        environment: this.config.environment,
        genesisHash: this.config.genesisHash
      });
    });

    // GET / - root page with visual rendering
    this.app.get('/', (req: Request, res: Response) => {
      const isCompiled = __dirname.includes('dist');
      const templatePath = isCompiled
        ? path.join(__dirname, '../templates/index.html')
        : path.join(process.cwd(), 'dist/indexer-web/templates/index.html');
      res.sendFile(templatePath);
    });
  }

  public start(port?: number): void {
    const serverPort = port || this.config.port || 3000;
    
    this.app.listen(serverPort, () => {
      console.log(`UBB Indexer Web Server started`);
      console.log(`Environment: ${this.config.environment}`);
      console.log(`Genesis Hash: ${this.config.genesisHash}`);
      console.log(`Port: ${serverPort}`);
      console.log(`Data path: ${this.dataPath}`);
      console.log(`\nEndpoints:`);
      console.log(`  - GET http://localhost:${serverPort}/`);
      console.log(`  - GET http://localhost:${serverPort}/states/tip (redirects to current tip)`);
      console.log(`  - GET http://localhost:${serverPort}/states/{hash}`);
      console.log(`  - GET http://localhost:${serverPort}/images/{txid}`);
      console.log(`  - GET http://localhost:${serverPort}/config`);
    });
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const envArg = args.find(arg => arg.startsWith('--env='));
  const portArg = args.find(arg => arg.startsWith('--port='));
  const genesisHashArg = args.find(arg => arg.startsWith('--genesis-hash='));
  
  const environment = envArg ? envArg.split('=')[1] as 'mainnet' | 'testnet' | 'regtest' : 'testnet';
  const port = portArg ? parseInt(portArg.split('=')[1]) : 3000;
  const genesisHash = genesisHashArg ? genesisHashArg.split('=')[1] : '';
  
  if (environment !== 'mainnet' && environment !== 'testnet' && environment !== 'regtest') {
    console.error('Invalid environment. Use --env=mainnet, --env=testnet, or --env=regtest');
    process.exit(1);
  }
  
  if (!genesisHash || !/^[a-fA-F0-9]{64}$/.test(genesisHash)) {
    console.error('Invalid or missing genesis hash. Use --genesis-hash=<64-char hex string>');
    process.exit(1);
  }
  
  const server = new IndexerWebServer({ environment, genesisHash, port });
  server.start();
}

export default IndexerWebServer;
