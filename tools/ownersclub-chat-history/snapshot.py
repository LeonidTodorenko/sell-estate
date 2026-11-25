"""Seal and restore the local OwnersClub archive as an age v1 snapshot."""

import argparse
import base64
import hashlib
import io
import re
import secrets
import shutil
import subprocess
import sqlite3
import stat
import sys
import tarfile
import tempfile
from pathlib import Path

from pyrage import DecryptError, passphrase

FILES = frozenset({
    "INDEX.md", "manifest.json", "state.json", "selection.json",
    "review.json", "last-import.json", "README.md", "HANDOFF.md",
    "tools/archive.py", "tests/test_archive.py",
})
DIALOGUE = re.compile(r"conversations/[0-9]{4,}_[-0-9a-z]{7,10}_[0-9a-f]{8}\.txt")
ARCHIVE_NAME = "ownersclub.age"
REQUIRED = {"INDEX.md", "manifest.json", "state.json", "tools/archive.py"}
MAX_BYTES = 95 * 1024 * 1024


def name_allowed(name):
    return name in FILES or DIALOGUE.fullmatch(name) is not None


def regular(path):
    info = path.lstat()
    return stat.S_ISREG(info.st_mode) and not getattr(info, "st_file_attributes", 0) & 0x400


def load_password(path):
    if not regular(path) or path.stat().st_size > 64:
        raise ValueError("Password policy")
    value = path.read_text(encoding="utf-8-sig").rstrip("\r\n")
    if not re.fullmatch(r"[A-Za-z0-9_-]{43}", value):
        raise ValueError("Password policy")
    raw = base64.urlsafe_b64decode(value + "=")
    if base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=") != value or len(set(raw)) < 20:
        raise ValueError("Password policy")
    return value


def pack(root):
    entries = [root / name for name in sorted(FILES) if (root / name).exists()]
    entries.extend(sorted((root / "conversations").glob("*.txt")))
    stream = io.BytesIO()
    total = 0
    with tarfile.open(fileobj=stream, mode="w:gz", format=tarfile.USTAR_FORMAT) as archive:
        for path in entries:
            name = path.relative_to(root).as_posix()
            if not name_allowed(name) or not regular(path):
                raise ValueError("Unexpected archive file")
            entry = tarfile.TarInfo(name)
            entry.size = path.stat().st_size
            total += entry.size
            if total > MAX_BYTES:
                raise ValueError("Archive size limit")
            with path.open("rb") as source:
                archive.addfile(entry, source)
    return stream.getvalue()


def unpack(payload, dest):
    seen = set()
    total = 0
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
        for entry in archive:
            total += entry.size
            if (entry.type != tarfile.REGTYPE or not name_allowed(entry.name)
                    or entry.name in seen or entry.size < 0 or total > MAX_BYTES):
                raise ValueError("Unexpected archive member")
            seen.add(entry.name)
            path = dest / entry.name
            path.parent.mkdir(exist_ok=True)
            with archive.extractfile(entry) as source, path.open("xb") as output:
                output.write(source.read())
    if not REQUIRED <= seen:
        raise ValueError("Incomplete archive")


def recovered_members(payload):
    with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
        return {member.name: hashlib.sha256(archive.extractfile(member).read()).digest()
                for member in archive}


def rebuild_index(root, archive):
    state = archive.load(root / "state.json", {})
    db_path = root / "search.sqlite3"
    if db_path.exists():
        raise FileExistsError("Index already exists")
    with sqlite3.connect(db_path) as db:
        with db:
            db.execute('CREATE VIRTUAL TABLE history USING fts5(cid UNINDEXED, mid UNINDEXED, utc UNINDEXED, role UNINDEXED, file UNINDEXED, title, body, tokenize="unicode61")')
            for cid, record in state.items():
                _, rows, _ = archive.render(cid, record)
                db.executemany("INSERT INTO history VALUES (?, ?, ?, ?, ?, ?, ?)", rows)
    archive.verify(root)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("self-test", "seal", "verify-staged", "restore", "rebuild-index"))
    parser.add_argument("root", type=Path, help="Restricted local archive outside Git")
    parser.add_argument("--password-file", type=Path)
    parser.add_argument("--review-approved", action="store_true",
                        help="Confirm manual review and independently generated password")
    parser.add_argument("--ciphertext", type=Path)
    args = parser.parse_args()
    try:
        root = args.root.resolve(strict=True)
        if args.action in ("seal", "verify-staged") and not args.review_approved:
            raise ValueError("Manual review and generation confirmation required")
        if args.action not in ("self-test", "rebuild-index") and args.password_file is None:
            raise ValueError("Password file required")
        password = None
        if args.action == "self-test":
            password = secrets.token_urlsafe(32)
        elif args.action != "rebuild-index":
            password = load_password(args.password_file)
        if args.action == "restore":
            if args.ciphertext is None or args.ciphertext.stat().st_size > MAX_BYTES:
                raise ValueError("Ciphertext required")
            payload = passphrase.decrypt(args.ciphertext.read_bytes(), password)
            dest = Path(tempfile.mkdtemp(prefix="restored-", dir=root))
            try:
                unpack(payload, dest)
            except Exception:
                shutil.rmtree(dest)
                raise
            print(dest)
            return
        sys.dont_write_bytecode = True
        sys.path.insert(0, str(root / "tools"))
        import archive

        lock = root / ".import.lock"
        lock.mkdir()
        try:
            if args.action == "rebuild-index":
                rebuild_index(root, archive)
                return
            archive.verify(root)
            if args.action == "verify-staged":
                cipher = subprocess.check_output(
                    ["git", "show", f":docs/chat-history/{ARCHIVE_NAME}"],
                    stderr=subprocess.DEVNULL,
                )
            else:
                cipher = passphrase.encrypt(pack(root), password)
            with tempfile.TemporaryDirectory(prefix=".restore-", dir=root) as temp:
                if len(cipher) > MAX_BYTES:
                    raise ValueError("Ciphertext size limit")
                recovered = passphrase.decrypt(cipher, password)
                unpack(recovered, Path(temp))
                rebuild_index(Path(temp), archive)
                if args.action == "verify-staged":
                    if recovered_members(recovered) != recovered_members(pack(root)):
                        raise ValueError("Staged archive is not the current local snapshot")
            if args.action == "self-test":
                for corrupted, key in (
                    (cipher, secrets.token_urlsafe(32)),
                    (cipher[:-1], password),
                    (cipher[:-1] + bytes([cipher[-1] ^ 1]), password),
                ):
                    try:
                        passphrase.decrypt(corrupted, key)
                    except DecryptError:
                        continue
                    raise ValueError("Authentication accepted invalid input")
            elif args.action == "seal":
                with (root / ARCHIVE_NAME).open("xb") as destination:
                    destination.write(cipher)
        finally:
            lock.rmdir()
        print("Snapshot verification passed.")
    except Exception as error:
        parser.exit(1, f"Snapshot operation refused ({type(error).__name__}).\n")


if __name__ == "__main__":
    main()
