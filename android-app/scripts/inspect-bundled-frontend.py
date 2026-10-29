"""Verify every bundled UI file against the package's own content manifest."""
import hashlib
import json
import sys
import zipfile
from pathlib import Path

package = Path(sys.argv[1])
with zipfile.ZipFile(package) as archive:
    prefix = "assets/frontend/" if "assets/frontend/bundle-manifest.json" in archive.namelist() else "base/assets/frontend/"
    manifest = json.loads(archive.read(prefix + "bundle-manifest.json"))
    seen = set()
    for entry in manifest["files"]:
        name = entry["path"]
        assert name and not name.startswith("/") and ".." not in name.split("/") and name not in seen
        seen.add(name)
        assert hashlib.sha256(archive.read(prefix + name)).hexdigest() == entry["sha256"], name
    assert "index.html" in seen
    assert not any(name.endswith(".map") or ".env" in name for name in seen)
    assert not any(value in archive.read(prefix + "index.html").decode() for value in ("fonts.googleapis.com", "posthog"))
report = {"status": "passed", "package": package.name, "sha256": hashlib.sha256(package.read_bytes()).hexdigest(), "frontendManifestEntriesVerified": len(seen)}
print(json.dumps(report))
