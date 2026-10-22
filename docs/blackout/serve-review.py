#!/usr/bin/env python3
"""Serve isolated review artifacts plus an allowlisted local reference cache.

No application endpoint, credentials, inference proxy or production deployment.
External pixels remain in the private local research cache, outside Git.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import json

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reference-cache', type=Path, required=True)
    parser.add_argument('--port', type=int, default=5194)
    args = parser.parse_args()
    evidence = json.loads((ROOT / 'REFERENCE_EVIDENCE.json').read_text())
    allowed = {x['id'] for x in evidence['manifestImages'] + evidence['additionalPinnedImages'] if x.get('retrieved') and x['id'] != 'cli_csdn'}

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *a, **kw):
            super().__init__(*a, directory=str(ROOT), **kw)

        def do_GET(self):
            if self.path.startswith('/reference-assets/'):
                name = self.path.removeprefix('/reference-assets/')
                if not name.endswith('.image') or name[:-6] not in allowed:
                    self.send_error(404)
                    return
                target = args.reference_cache / name
                if not target.is_file():
                    self.send_error(404, 'Reference cache missing; use the original linked source')
                    return
                self.send_response(200)
                self.send_header('Content-Type', self.guess_type(str(target)) if target.suffix != '.image' else 'application/octet-stream')
                self.send_header('Cache-Control', 'private, max-age=600')
                self.end_headers()
                self.wfile.write(target.read_bytes())
                return
            super().do_GET()

    ThreadingHTTPServer(('0.0.0.0', args.port), Handler).serve_forever()


if __name__ == '__main__':
    main()
