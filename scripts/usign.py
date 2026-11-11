#!/usr/bin/env python3
"""OpenWrt usign (signify-compatible Ed25519) keys and signatures for the opkg feed.

    python3 scripts/usign.py keygen SECRET PUBLIC [COMMENT]   new key pair (maintainers, once)
    python3 scripts/usign.py fingerprint PUBLIC               name opkg-key gives the key
    python3 scripts/usign.py sign SECRET FILE SIGNATURE       FILE.sig as usign -S writes it
    python3 scripts/usign.py verify PUBLIC FILE SIGNATURE     exit 0 when valid (usign -V)

CI signs with the real usign binary inside an OpenWrt container; this tool
creates the key pair and lets the tests check signatures without OpenWrt.
Needs the Python `cryptography` package.

File formats (usign main.c): two lines, "untrusted comment: …" and base64 of
    public    "Ed" | fingerprint[8] | public key[32]
    secret    "Ed" | "BK" | kdfrounds u32 (0 = unencrypted) | salt[16] |
              sha512(secret)[:8] | fingerprint[8] | seed[32] + public key[32]
    signature "Ed" | fingerprint[8] | Ed25519 signature[64] of the whole file
"""
import base64
import hashlib
import os
from pathlib import Path
import sys


def _crypto():
    try:
        from cryptography.hazmat.primitives.asymmetric import ed25519
        from cryptography.hazmat.primitives import serialization
    except ImportError:
        sys.exit('usign.py needs the Python "cryptography" package (or use usign on OpenWrt)')
    return ed25519, serialization


def _read(path, size, label):
    lines = Path(path).read_text(encoding='ascii').splitlines()
    if len(lines) < 2 or not lines[0].startswith('untrusted comment:'):
        raise SystemExit(f'{path}: not a usign {label} file')
    blob = base64.b64decode(lines[1].strip(), validate=True)
    if len(blob) != size or blob[:2] != b'Ed':
        raise SystemExit(f'{path}: not a usign {label} file')
    return blob


def _write(path, comment, blob, private=False):
    data = f'untrusted comment: {comment}\n{base64.b64encode(blob).decode()}\n'
    if private:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='ascii') as f:
            f.write(data)
    else:
        Path(path).write_text(data, encoding='ascii')


def read_public(path):
    blob = _read(path, 42, 'public key')
    return blob[2:10], blob[10:42]


def read_secret(path):
    blob = _read(path, 104, 'secret key')
    if blob[2:4] != b'BK' or int.from_bytes(blob[4:8], 'big') != 0:
        raise SystemExit(f'{path}: encrypted usign keys are not supported')
    secret = blob[40:104]
    if hashlib.sha512(secret).digest()[:8] != blob[24:32]:
        raise SystemExit(f'{path}: secret key checksum mismatch')
    return blob[32:40], secret


def fingerprint(path):
    return read_public(path)[0].hex()


def keygen(secret_path, public_path, comment='Carbon feed'):
    ed25519, serialization = _crypto()
    key = ed25519.Ed25519PrivateKey.generate()
    seed = key.private_bytes(serialization.Encoding.Raw, serialization.PrivateFormat.Raw, serialization.NoEncryption())
    public = key.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    fp = os.urandom(8)
    secret = seed + public
    _write(secret_path, f'{comment} secret key', b'EdBK' + bytes(4) + os.urandom(16) +
           hashlib.sha512(secret).digest()[:8] + fp + secret, private=True)
    _write(public_path, f'{comment} public key', b'Ed' + fp + public)
    return fp.hex()


def sign(secret_path, message_path, signature_path):
    ed25519, _ = _crypto()
    fp, secret = read_secret(secret_path)
    sig = ed25519.Ed25519PrivateKey.from_private_bytes(secret[:32]).sign(Path(message_path).read_bytes())
    _write(signature_path, f'signed by key {fp.hex()}', b'Ed' + fp + sig)


def verify(public_path, message_path, signature_path):
    ed25519, _ = _crypto()
    fp, public = read_public(public_path)
    blob = _read(signature_path, 74, 'signature')
    if blob[2:10] != fp:
        return False
    try:
        ed25519.Ed25519PublicKey.from_public_bytes(public).verify(blob[10:], Path(message_path).read_bytes())
    except Exception:
        return False
    return True


def main(argv):
    cmd, args = (argv[0], argv[1:]) if argv else ('', [])
    if cmd == 'keygen' and len(args) in (2, 3):
        print(keygen(*args))
    elif cmd == 'fingerprint' and len(args) == 1:
        print(fingerprint(args[0]))
    elif cmd == 'sign' and len(args) == 3:
        sign(*args)
    elif cmd == 'verify' and len(args) == 3:
        ok = verify(*args)
        print('OK' if ok else 'BAD signature', file=sys.stderr)
        return 0 if ok else 1
    else:
        print(__doc__.strip(), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
