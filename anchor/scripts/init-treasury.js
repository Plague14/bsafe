// One-time setup: initialize the BSafe protocol fee treasury PDA on a cluster.
//
// Usage (from anchor/):
//   node scripts/init-treasury.js [rpcUrl] [keypairPath]
// Defaults: devnet RPC, ./deployer-keypair.json

const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const idl = require("../target/idl/bsafe.json");

async function main() {
  const rpcUrl = process.argv[2] || "https://api.devnet.solana.com";
  const keypairPath = process.argv[3] || path.join(__dirname, "..", "deployer-keypair.json");

  const authority = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf8")))
  );
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(authority), {
    commitment: "confirmed",
  });
  const program = new anchor.Program(idl, provider);

  const [treasury] = PublicKey.findProgramAddressSync(
    [Buffer.from("bsafe_treasury")],
    program.programId
  );

  const existing = await connection.getAccountInfo(treasury);
  if (existing && existing.owner.equals(program.programId)) {
    console.log(`Treasury already initialized: ${treasury.toBase58()}`);
    return;
  }

  const sig = await program.methods
    .initializeTreasury()
    .accounts({ treasury, authority: authority.publicKey })
    .rpc();
  console.log(`Treasury initialized: ${treasury.toBase58()}\nTx: ${sig}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
