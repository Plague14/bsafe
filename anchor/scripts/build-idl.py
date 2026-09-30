"""Generate target/idl/bsafe.json and target/types/bsafe.ts.

`anchor idl build` (Anchor 0.30.1) compiles with `--cfg procmacro2_semver_exempt`,
which breaks on current Rust toolchains (proc_macro::SourceFile was removed in 1.88,
and ark-bn254's MontFp! macro panics under that cfg). This script runs the same
`__anchor_private_print_idl` tests without that flag and assembles the IDL the way
Anchor does: program IDL + address + errors, with module paths shortened.

Usage (from anchor/):  python scripts/build-idl.py
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROGRAM_DIR = os.path.join(ROOT, "programs", "bsafe")
IDL_OUT = os.path.join(ROOT, "target", "idl", "bsafe.json")
TYPES_OUT = os.path.join(ROOT, "target", "types", "bsafe.ts")


def run_print_idl() -> str:
    env = dict(os.environ)
    env.pop("RUSTFLAGS", None)
    env["ANCHOR_IDL_BUILD_PROGRAM_PATH"] = PROGRAM_DIR
    result = subprocess.run(
        ["cargo", "test", "__anchor_private_print_idl", "--features", "idl-build",
         "--", "--show-output", "--quiet"],
        cwd=PROGRAM_DIR, env=env, capture_output=True, text=True, encoding="utf-8",
    )
    if result.returncode != 0:
        sys.stderr.write(result.stdout + result.stderr)
        sys.exit("IDL print tests failed")
    return result.stdout


def section(output: str, name: str):
    match = re.search(rf"--- IDL begin {name} ---\n(.*?)\n--- IDL end {name} ---", output, re.S)
    return json.loads(match.group(1)) if match else None


def shorten_paths(idl: dict) -> dict:
    """Replace `bsafe::state::vault::Vault` with `Vault` when the short name is unique."""
    full_names = [t["name"] for t in idl.get("types", [])]
    short = {n: n.split("::")[-1] for n in full_names}
    if len(set(short.values())) != len(short):
        return idl
    text = json.dumps(idl)
    for full, s in sorted(short.items(), key=lambda kv: -len(kv[0])):
        text = text.replace(f'"{full}"', f'"{s}"')
    return json.loads(text)


KNOWN_PROGRAM_ADDRESSES = {
    "system_program": "11111111111111111111111111111111",
}


def add_known_addresses(idl: dict) -> dict:
    """Without procmacro2_semver_exempt, anchor-syn omits `address` for `Program<System>`
    accounts; clients (anchor.Program) need it to auto-resolve those accounts."""
    for ix in idl["instructions"]:
        for account in ix["accounts"]:
            address = KNOWN_PROGRAM_ADDRESSES.get(account["name"])
            if address and "address" not in account:
                account["address"] = address
    return idl


def camel(s: str) -> str:
    head, *rest = s.split("_")
    return head + "".join(p[:1].upper() + p[1:] for p in rest)


def to_camel_case(idl: dict) -> dict:
    """Mirror Anchor's TS type generation: snake_case identifiers become camelCase."""
    def fix(node):
        if isinstance(node, dict):
            out = {}
            for k, v in node.items():
                if k == "name" and isinstance(v, str):
                    out[k] = camel(v)
                elif k == "path" and isinstance(v, str):
                    out[k] = ".".join(camel(p) for p in v.split("."))
                else:
                    out[k] = fix(v)
            return out
        if isinstance(node, list):
            return [fix(v) for v in node]
        return node

    ts = dict(idl)
    ts["instructions"] = fix(idl["instructions"])
    ts["types"] = [
        {**t, "type": fix(t["type"])} for t in idl.get("types", [])
    ]
    ts["errors"] = [{**e, "name": camel(e["name"][0].lower() + e["name"][1:])} for e in idl.get("errors", [])]
    ts["events"] = idl.get("events", [])
    return {k: v for k, v in ts.items() if v != []}


def main():
    output = run_print_idl()
    idl = section(output, "program")
    if idl is None:
        sys.exit("No program IDL found in test output")
    address = section(output, "address")
    if address:
        # The address section is a quoted string literal (e.g. "\"3a7Y...\"")
        idl["address"] = address.strip('"')
    errors = section(output, "errors")
    if errors:
        idl["errors"] = errors
    idl = add_known_addresses(shorten_paths(idl))

    os.makedirs(os.path.dirname(IDL_OUT), exist_ok=True)
    os.makedirs(os.path.dirname(TYPES_OUT), exist_ok=True)
    with open(IDL_OUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(idl, f, indent=2)
        f.write("\n")

    ts_idl = to_camel_case(idl)
    with open(TYPES_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("/**\n * Program IDL in camelCase format in order to be used in JS/TS.\n *\n")
        f.write(" * Note that this is only a type helper and is not the actual IDL. The original\n")
        f.write(" * IDL can be found at `target/idl/bsafe.json`.\n */\n")
        f.write("export type Bsafe = " + json.dumps(ts_idl, indent=2) + ";\n")

    print(f"IDL: {len(idl['instructions'])} instructions, {len(idl.get('accounts', []))} accounts, "
          f"{len(idl.get('types', []))} types, {len(idl.get('errors', []))} errors")
    print(f"Wrote {IDL_OUT}\nWrote {TYPES_OUT}")


if __name__ == "__main__":
    main()
