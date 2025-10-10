# The Unstoppable Bitcoin Billboard (UBB) — Protocol v1

## 1. Plain-English Overview

The Unstoppable Bitcoin Billboard (UBB) is an authorityless, censorship-resistant billboard that lives on Bitcoin. Anyone can claim a portion of the billboard, draw an image there, and optionally include a link.

- The billboard is a virtual canvas on the Bitcoin chain with **65,536 × 65,536 pixels**.
- Anyone can claim a rectangular area on the billboard (a "plot") with a specifically formed Bitcoin transaction, provided it doesn't overlap with anything already there.
- Each plot consists of an image, and can optionally include a **URL** linking to external content.
- Each plot is bound to a **deed** (a 600-sat UTXO). Whoever controls the deed controls the plot.
- You can transfer the deed to someone else, update the art, or retry your claim if it was rejected because it overlapped with someone else's existing plot.
- If deed is destroyed, the plot is **bricked forever** (cannot be updated or transferred).

### How to claim a plot

### UBB Wallet Scripts
There are scripts included that you can use (at your own risk) which
will create claims.

```bash
npm run make-claim -- --x <x> --y <y> --uri <uri> --image <path> --core-rpc-url <url> --wallet-name <name> --network mainnet
```

### Roll your own transaction

#### Option 1: Web Tool + Bitcoin Core CLI

1. Go to [The Claim Builder](https://mysticalgareth.github.io/UBB/claim-builder.html) to build your claim message. The tool will output hex-encoded OP_RETURN data.

2. Verify it's valid using the [Verifier](https://mysticalgareth.github.io/UBB/ubb-verifier.html)

3. Construct and broadcast using `bitcoin-cli`:

```bash
# Step 1: Create raw transaction with OP_RETURN and 600-sat deed output
RAW_TX=$(bitcoin-cli -rpcwallet=<your-wallet> createrawtransaction \
  '[]' \
  '{"data":"<claim-hex-from-builder>","<your-address>":0.000006}')

# Step 2: Add inputs and change output (handles fees automatically)
FUNDED_TX=$(bitcoin-cli -rpcwallet=<your-wallet> fundrawtransaction "$RAW_TX" | jq -r '.hex')

# Step 3: Sign the transaction
SIGNED_TX=$(bitcoin-cli -rpcwallet=<your-wallet> signrawtransactionwithwallet "$FUNDED_TX" | jq -r '.hex')

# Step 4: Broadcast to network
bitcoin-cli sendrawtransaction "$SIGNED_TX"
```

**Important notes:**
- The deed output must be *exactly* 600 sats (0.000006 BTC).
- Replace `<claim-hex-from-builder>` with the hex from the Claim Builder (without `0x` prefix).
- Replace `<your-address>` with an address from your wallet (this becomes the deed owner).
- `fundrawtransaction` automatically selects inputs and adds a change output.
- Requires `jq` for JSON parsing, or manually extract the `hex` field from each response.

#### Option 2: Web Tool Only

Alternatively, you can use the Claim Builder to generate the OP_RETURN data, then manually construct a transaction with:
- An OP_RETURN output containing the hex bytes from the Claim Builder
- Exactly one 600-sat output to a Bitcoin address you control (the deed)
- Any other outputs (change, etc.) as needed

### Why?

Seemed like a fun thing to try. Gives people a use for the newly relaxed
OP_RETURN policy in core v30.

What UBB achieves:

- **Supply-limited resource:** The 65,536 × 65,536 canvas is finite. Plots cannot overlap. First to claim wins.
- **Censorship-resistant:** Once placed, plots are permanent. No authority can remove or alter them.
- **No intermediaries:** The protocol is rules observed by indexers. No tokens, no servers, no gatekeepers.
- **Fee market contribution:** Every plot claim, update, and transfer generates transaction fees that fund Bitcoin's security beyond the block subsidy.
- **Maximizes miner fees:** By using `OP_RETURN` instead of witness data, UBB avoids the witness discount and pays full weight-based fees to miners. It also uses uncompressed bitmap encoding, maximising fees per pixel.
- **Node-friendly storage:** `OP_RETURN` outputs are provably unspendable and can be pruned from the UTXO set, unlike techniques that embed data in `scriptPubKey` of spendable outputs (which nodes must retain indefinitely).

## 2. Network Deployment

### Mainnet Genesis
- **Genesis Block Hash:** `000000000000000000010fa5bf8de1bff433e934e03ed671186592c8c3560f6e`
- The mainnet UBB genesis block contains the first valid UBB CLAIM transaction on Bitcoin mainnet.
- This genesis block defines the canonical start of the mainnet UBB timeline.

## 3. Core Concepts

### 3.1 Billboard (Canvas)
- **Total size:** 65,536 × 65,536 pixels  
- **Coordinates:** `0 ≤ x,y ≤ 65,535`  
- Fits in 16-bit unsigned integers (2 bytes per coordinate).  
- **Origin:** `(0,0)` = top-left corner.  
- A **plot** = rectangle defined by `(x0,y0)` and `(w,h)` from the BMP header.  
- **Zero-sized plots** (`w=0` or `h=0`) are forbidden.  
- Placement uses **absolute height** (BMP may encode top-down or bottom-up).  

### 3.2 Placement Rules
- **PLACED**: inside the canvas, no overlap with already-PLACED plots (blockchain order).  
- **UNPLACED**: overlaps or goes out of bounds.  
- **BRICKED**: deed chain broken by invalid spend. Visibility depends on status before bricking:
  - If PLACED when bricked → remains visible (frozen at coordinates, occupies space)
  - If UNPLACED when bricked → remains invisible (coordinates never occupied, available for others)  

### 3.3 Deeds (Ownership)
- A deed is represented by a **UTXO of exactly 600 sats**.  
- **Any transaction that spends a deed UTXO is a UBB transaction** (regardless of OP_RETURN data).
- Every UBB transaction must create exactly **one output of 600 sats** (the new deed).  
- The transaction must contain **exactly one output of 600 sats total**, regardless of script type (spendable or unspendable).
- Multiple 600-sat outputs = ambiguous = **BRICKED**.
- If sent to an unspendable script, the deed chain continues but the plot becomes permanently uncontrollable.  
- The deed UTXO is identified solely by:  
  - Value = **exactly 600 sats**  
  - Status = **last unspent output in the deed chain**  
- The current owner = controller of the latest deed UTXO in its chain.  
- If a deed UTXO is spent without creating exactly one output of 600 sats, the plot is **BRICKED**.  

### 3.4 Identifiers
- **Magic bytes:** `0x13 0x37`  
- **Version:** `0x01`  
- **Transaction types:**
  - `0x01` = CLAIM
  - `0x02` = RETRY-CLAIM  
  - `0x03` = UPDATE
  - `0x04` = TRANSFER
- UBB data lives in an `OP_RETURN` starting with these bytes.  

URI (CBOR text) rules:
- Required for CLAIM and UPDATE; must be a CBOR definite-length text string starting immediately after `y0`.
- Can be empty (CBOR `0x60`).
- MUST use definite-length encoding (indefinite-length `0x7F` is forbidden).
- MUST NOT contain null bytes (`0x00`).
- If the CBOR value is not a text string (major type 3) or is malformed, the OP_RETURN payload is considered invalid.
- No scheme restrictions at index time; UIs should treat as untrusted.

### 3.5 Global Transaction Rules
- A UBB transaction **MUST NOT contain more than one UBB `OP_RETURN` output** (OP_RETURN starting with magic bytes `0x13 0x37`).  
- If multiple UBB OP_RETURN outputs exist, **all UBB data is ignored and the transaction is treated as TRANSFER only**.  
- Non-UBB OP_RETURN outputs (without magic bytes) are permitted and do not affect UBB validation.
- Deed rules are still enforced even when UBB data is ignored.  
- Applies to all transaction types: CLAIM, RETRY-CLAIM, UPDATE, TRANSFER.  
- Within a block, **indexers must treat block serialization order as authoritative** for conflict resolution.  

Validation and processing semantics:
- OP_RETURN parsing order is: magic → version → type → `x0`/`y0` → URI (CBOR text) → BMP data.
- For CLAIM and UPDATE:
  - URI is required and must be a CBOR definite-length text string.
  - BMP data is required and must follow immediately after the URI.
  - If either requirement is not met (missing/malformed URI, missing BMP), the OP_RETURN payload is considered invalid.
- Invalid OP_RETURN payloads are ignored by indexers; the enclosing Bitcoin transaction is still processed for deed flow.
- Specifically for UPDATE: if the OP_RETURN payload is invalid, treat the transaction as transfer-only so the deed chain continues (avoids accidental bricking).  

## 4. Transaction Types

### 4.1 CLAIM (new plot)

OP_RETURN: [0x13 0x37] | [0x01] | [0x01] | x0[2] | y0[2] | URI(CBOR text) | BMP(…)

- Must include exactly one deed UTXO of 600 sats.  
- `(x0,y0)` = top-left corner; `(w,h)` read from BMP header.  
- If valid → **PLACED**.  
- If invalid (overlap/out of bounds) → **UNPLACED**.  
 - If the OP_RETURN payload is malformed (e.g., missing/malformed URI or missing BMP), the OP_RETURN is ignored and the deed rules still apply to the transaction.

### 4.2 RETRY-CLAIM (move an unplaced plot)

OP_RETURN: [0x13 0x37] | [0x01] | [0x02] | x0'[2] | y0'[2]

- Must spend the current deed UTXO and create exactly one new deed UTXO of 600 sats.  
- Uses original `(w,h)` from the CLAIM’s BMP.  
- May only be applied to **UNPLACED** plots.  
- If valid → becomes **PLACED** at new coords.  
- If invalid → ignored, deed still transfers, plot remains UNPLACED.  

**Rationale:** prevents wasted fees. If two CLAIMs overlap, only the first mined is PLACED. RETRY-CLAIM lets the loser move their art without starting over.  

### 4.3 UPDATE (replace art, same rectangle)

OP_RETURN: [0x13 0x37] | [0x01] | [0x03] | x0[2] | y0[2] | URI(CBOR text) | BMP(…)

- Must spend the current deed UTXO and create exactly one new deed UTXO of 600 sats.  
- `(x0,y0,w,h)` must match the original CLAIM.  
- If match → art replaced.  
- If not → ignored, deed still transfers.  
 - If the OP_RETURN payload is malformed (e.g., missing/malformed URI or missing BMP), treat as transfer-only; the deed must still move exactly once to avoid bricking.  

### 4.4 TRANSFER (ownership only)
- No `OP_RETURN`.  
- Must spend the current deed UTXO and create exactly one new deed UTXO of 600 sats.  
- Can include other outputs (change, payments).  
- If not → plot is **BRICKED**.  

### 4.5 BRICK
- Any transaction that spends a deed UTXO without creating exactly one new deed output → plot is **BRICKED**.
- Ways to brick a plot:
  - No deed output created (0 outputs of exactly 600 sats)
  - Multiple deed outputs created (2+ outputs of exactly 600 sats - ambiguous)
- **Terminology:** A "deed output" means exactly 600 sats (spendable or not).
- Any transaction with multiple `OP_RETURN` outputs → UBB data ignored, deed rules still enforced.  
- Once BRICKED, the plot is frozen in its current visible state:
  - **PLACED** stays visible (occupies coordinates forever).  
  - **UNPLACED** stays off the billboard (coordinates available).  
- BRICKED plots have **no owner** and cannot be reclaimed.  
- Bricking can occur either by mistake or intentionally, both are permanent.
- **Note:** A transaction with valid deed flow but no/invalid OP_RETURN is just a TRANSFER (not bricked).  

## 5. Image Format

- Must be a valid **Windows BMP**.  
- Allowed formats:  
  - **24-bit (RGB, 8 bits per channel)**  
  - **32-bit (RGBA, 8 bits per channel)**  
- Compression: must be **BI_RGB (0) = uncompressed only**.  
- Any other variant (1/4/8/16-bit, RLE, bitfields, HDR depths, etc.) = invalid.  
- Width and height are read directly from the BMP header.  
- **Height encoding:** BMP height may be negative (bottom-up) or positive (top-down). Indexers **must use `abs(height)`** for all dimension validation and placement calculations.
- Validation:  

file_length == header_size + stride × abs(height)
stride = ceil(width × bytes_per_pixel / 4) × 4

- If mismatch → invalid.  
- Rendering is client-defined.  
- Alpha in 32-bit BMPs may be used or ignored (variability is permitted).  

**Why BMP?**
- Size grows directly with area (`w × h × bpp`). Bigger plots = more expensive.  
- Widely supported (Photoshop, GIMP, Krita, Paint.NET, MS Paint).  
- Simple validation (header + file length check).  
- Easy to render with a small JavaScript `<canvas>` decoder.  

## 6. Ordering & Conflicts
- Transactions applied in strict blockchain order:  
  1. Lower block height first.  
  2. Within a block: order of transactions in the block serialization (authoritative).  
- Chain reorgs: indexers must roll back and reapply.  
- First valid CLAIM at a location wins. Later overlapping CLAIMs are **UNPLACED**.  
- UPDATE and RETRY-CLAIM apply only to their own deed UTXO chain.  

## 7. Indexer Workflow
1. Scan for `OP_RETURN` starting with `0x13 0x37 0x01`.  
2. For each:  
   - **CLAIM** → parse BMP, check bounds/overlap → PLACED/UNPLACED.  
   - **RETRY-CLAIM** → if deed UTXO valid, try placement → PLACED or transfer-only.  
   - **UPDATE** → if rectangle matches → replace art; else transfer-only.  
   - Multiple OP_RETURNs → ignore UBB data.  
3. Track deed UTXOs:  
   - Every action must spend the old deed and create exactly one new 600-sat deed UTXO.  
   - If not → plot BRICKED.  
4. Billboard = all current PLACED plots with latest art.  
5. Current owner = controller of the latest deed UTXO.  
   - Unless BRICKED → no owner.  
6. RETRY-CLAIM/UPDATE must be resolved by walking the deed UTXO chain back to the original CLAIM.  

## 8. Lifecycle Recap
1. **CLAIM** → new plot + deed UTXO.  
2. If **UNPLACED** → use **RETRY-CLAIM** until valid.  
3. Once **PLACED** → can **UPDATE** art or **TRANSFER** deed.  
4. If deed UTXO rules are broken → plot is **BRICKED forever**.  

## 9. Design Rationale

### Why BMP, not PNG/WebP/SVG?
- PNG/WebP compress too well → billboard space too cheap.  
- SVG/vector formats compress infinitely better (one byte could fill millions of pixels).  
- BMP is uncompressed → cost scales with area → **blockspace scarcity is the limiter**.  

### Why restrict to 24/32-bit uncompressed?
- Defaults in mainstream design tools.  
- Indexed/compressed formats add complexity and attack surface.  
- Restricting keeps validation trivial and outputs consistent.  

### Why RETRY-CLAIM?
- Prevents wasted fees.  
- If two users overlap, one loses. Without RETRY, loser’s plot would be stuck **UNPLACED**.  
- RETRY lets them move their art to another location.  

### Why Bricking?
- Enforces discipline.  
- If deed rules break, the chain ends.  
- Plot frozen → no recycling or re-use.  
- Mistakes and intentional burns are permanent; the billboard evolves irreversibly.  

### Why 65,536 × 65,536?
- Fits neatly in **2-byte unsigned integers** (0 … 65,535).  
- 65,535 is the max expressible unsigned integer in 2 bytes without overflow.
- 0 is a co-ordinate, hence 65,536

## 10. Additional wallet tools
**Create a retry-claim (move plot to new coordinates):**
```bash
npm run make-retry-claim -- --x <x> --y <y> --deed-utxo <txid:vout> --core-rpc-url <url> --wallet-name <name> --network mainnet
```

**Update an existing plot (change image/URI):**
```bash
npm run make-update -- --x <x> --y <y> --deed-utxo <txid:vout> --image <path> --core-rpc-url <url> --wallet-name <name> --network mainnet
```

**Transfer plot ownership:**
```bash
npm run make-transfer -- --deed-utxo <txid:vout> --core-rpc-url <url> --wallet-name <name> --network mainnet
```

## 11. Development & Testing

### Testing

Note: If you want end to end tests to pass you need bitcoind and
bitcoin-cli in your PATH.

```
npm test
```

### Indexer & Web Server

TODO: Info about running indexer


### Populating a regtest environment

**Populate billboard with multiple claims:**
```bash
npm run populate -- 25 5 --core-rpc-url <url> --wallet-name <name> --network regtest
```
